import { describe, expect, it } from "vitest";

import {
  buildPlayerFacingCombatContext,
  buildPlayerFacingScenarioParticipant,
  mergePlayerSubmittedScenarioParticipantState,
  type PlayerFacingScenarioParticipant,
} from "../campaign/playerFacingScenarioParticipant";
import {
  scenarioParticipantCombatContextSchema,
  scenarioParticipantSchema,
  scenarioParticipantStateSchema,
  type ScenarioParticipant,
} from "../campaign/scenario";
import { combatRoundCommandSchema, type CombatRoundCommand } from "./combatRoundManager";
import {
  canonicalCombatModifierEffectSchema,
  transitionCanonicalCombatModifierEffect,
} from "./combatModifierLifecycle";
import { buildCanonicalCombatModifierReviewFromDraft } from "./combatModifierReviewProjection";
import {
  buildPlayerFacingCombatRoundCommand,
  type PlayerFacingCombatRoundCommand,
} from "./playerFacingCombatRoundCommand";
import {
  buildPlayerFacingEncounterSession,
  type PlayerFacingEncounterSession,
} from "./playerFacingEncounterSession";
import { encounterSessionSchema, type EncounterSession } from "./session";

/**
 * Forgejo #502 (privacy hardening, Tier 1): the declared player-facing types.
 *
 * The first block is a compile-time proof. Each `@ts-expect-error` asserts that a stored value is
 * NOT assignable to its player-facing type; if it ever became assignable, the directive would be
 * unused and `tsc` (run over test files by `pnpm typecheck`) would fail.
 */
const NAMED_PRIVATE_KEYS = [
  "canonicalTransitions",
  "canonicalLifecycle",
  "gmOverride",
  "privateDiagnostic",
  "createdByUserId",
  "nextEffect",
  "previousEffect",
] as const;

function keysAnywhere(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) keysAnywhere(entry, found);
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) found.add(key);
      keysAnywhere(nested, found);
    }
  }
  return found;
}

function storedCommand(): CombatRoundCommand {
  return combatRoundCommandSchema.parse({
    afterCursor: { participantId: "guard", roundNumber: 3, step: "A1" },
    beforeCursor: { participantId: "hero", roundNumber: 3, step: "A1" },
    createdAt: "2026-10-04T10:00:00.000Z",
    createdByUserId: "SECRET_ACTOR_USER",
    facts: { nextEffect: { id: "SECRET_NEXT" }, previousEffect: { id: "SECRET_PREVIOUS" } },
    id: "command-1",
    participantId: "hero",
    phase: "phase1",
    roundNumber: 3,
    step: "A1",
    type: "skip_phase_action",
  });
}

/** A canonical lifecycle and transition, built by the real engine, with private fields set. */
function canonicalLifecycleWithPrivateMaterial() {
  const context = (rows: unknown[]) =>
    scenarioParticipantCombatContextSchema.parse({
      modifierBuckets: {
        general: rows,
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      },
    });
  const transaction = buildCanonicalCombatModifierReviewFromDraft({
    canonicalCutoff: 5,
    commandId: "command-review",
    createdAt: "2026-10-04T09:00:00.000Z",
    currentContext: context([]),
    draftContext: context([{ durationRounds: 2, id: "row-new", scope: "until", value: -10 }]),
    encounterId: "encounter-1",
    participantState: scenarioParticipantStateSchema.parse({
      combat: {},
      equipment: {},
      health: {},
      resources: {},
    }),
    phase: "M1",
    revision: "2026-10-04T09:00:00.000Z",
    roundNumber: 3,
    scenarioParticipantId: "participant-1",
  });
  const effect = transaction.outputEffects.find((candidate) => candidate.id === "row-new");
  if (!effect) throw new Error("Expected a canonical effect from the review engine.");
  const transitioned = transitionCanonicalCombatModifierEffect({
    acceptedRevision: "2026-10-04T09:30:00.000Z",
    acceptedSequence: 6,
    effect,
    gmOverride: { reasonCode: "SECRET_GM_OVERRIDE_REASON", userId: "SECRET_GM_USER" },
    nextState: effect.lifecycle.state,
    privateDiagnostic: { code: "SECRET_TRANSITION_DIAGNOSTIC" },
    reason: "duration_decremented",
    transitionId: "transition-1",
    transitionType: "update",
  });
  return {
    lifecycle: canonicalCombatModifierEffectSchema.parse({
      ...transitioned.effect,
      privateDiagnostic: { code: "SECRET_LIFECYCLE_DIAGNOSTIC" },
    }),
    transition: transitioned.transition,
  };
}

function storedParticipantWithPrivateMaterial(): ScenarioParticipant {
  const { lifecycle, transition } = canonicalLifecycleWithPrivateMaterial();
  const modifierEntry = {
    canonicalLifecycle: lifecycle,
    canonicalTransitions: [transition],
    id: lifecycle.id,
    scope: "until",
    value: -10,
  };
  return scenarioParticipantSchema.parse({
    controlledByUserId: "player-1",
    createdAt: "2026-10-04T08:00:00.000Z",
    id: "participant-1",
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { displayName: "Hero" },
    sourceType: "character",
    state: {
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [modifierEntry],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        declarationSubmittedByUserId: "SECRET_DECLARING_USER",
      },
      combatEffects: {
        effects: [
          {
            canonicalLifecycle: lifecycle,
            canonicalTransitions: [transition],
            createdAt: "2026-10-04T09:00:00.000Z",
            effectGroup: "general",
            id: lifecycle.id,
            sourceEventId: "effect-event-1",
            targetParticipantId: lifecycle.ownerParticipantId,
            type: "general_modifier",
            updatedAt: "2026-10-04T09:30:00.000Z",
          },
        ],
        events: [
          {
            createdAt: "2026-10-04T09:00:00.000Z",
            createdByUserId: "SECRET_EFFECT_AUTHOR",
            id: "effect-event-1",
            targetParticipantId: lifecycle.ownerParticipantId,
          },
        ],
      },
      equipment: {},
      health: {},
      resources: {},
    },
    updatedAt: "2026-10-04T09:30:00.000Z",
  });
}

function storedEncounter(): EncounterSession {
  return encounterSessionSchema.parse({
    createdAt: "2026-10-04T08:00:00.000Z",
    gmPrivateClosingNote: "SECRET_CLOSING_NOTE",
    id: "encounter-1",
    title: "Bridge",
    updatedAt: "2026-10-04T09:00:00.000Z",
  });
}

describe("#502 player-facing types: non-assignability from internal types", () => {
  it("rejects a stored command, participant, and encounter at compile time", () => {
    const command = storedCommand();
    const participant = storedParticipantWithPrivateMaterial();
    const encounter = storedEncounter();

    // @ts-expect-error A stored command is not a player command.
    const rawCommand: PlayerFacingCombatRoundCommand = command;
    // @ts-expect-error A stored participant is not a player participant.
    const rawParticipant: PlayerFacingScenarioParticipant = participant;
    // @ts-expect-error A stored encounter is not a player encounter.
    const rawEncounter: PlayerFacingEncounterSession = encounter;

    expect([rawCommand, rawParticipant, rawEncounter]).toHaveLength(3);
  });

  it("rejects a stored command even when it is field-for-field the player shape", () => {
    // Without the brand this would be assignable: every remaining field exists on both types.
    const { createdByUserId: _actor, ...sameShape } = storedCommand();

    // @ts-expect-error Structural identity is not enough; only the builder produces the type.
    const rawCommand: PlayerFacingCombatRoundCommand = sameShape;

    expect(rawCommand).toBeDefined();
  });

  it("accepts the values the player-facing builders produce", () => {
    const command: PlayerFacingCombatRoundCommand = buildPlayerFacingCombatRoundCommand({
      command: storedCommand(),
      facts: {},
    });
    const participant: PlayerFacingScenarioParticipant = buildPlayerFacingScenarioParticipant(
      storedParticipantWithPrivateMaterial(),
    );
    const encounter: PlayerFacingEncounterSession = buildPlayerFacingEncounterSession({
      projectedEncounter: storedEncounter(),
    });

    expect([command, participant, encounter]).toHaveLength(3);
  });
});

describe("#502 player-facing types: additive construction", () => {
  it("builds a player command from named envelope fields without the actor identity", () => {
    const command = buildPlayerFacingCombatRoundCommand({
      command: { ...storedCommand(), futureInternalField: "SECRET_FUTURE" } as CombatRoundCommand,
      facts: { choice: "back_out" },
    });

    expect(Object.keys(command)).toEqual([
      "afterCursor",
      "beforeCursor",
      "createdAt",
      "facts",
      "id",
      "participantId",
      "phase",
      "roundNumber",
      "step",
      "type",
    ]);
    expect(command.facts).toEqual({ choice: "back_out" });
    expect(JSON.stringify(command)).not.toContain("SECRET");
  });

  it("keeps every named private key out of the player participant although each is populated", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const storedKeys = keysAnywhere(stored);
    for (const key of NAMED_PRIVATE_KEYS.filter((key) => !key.endsWith("Effect"))) {
      expect(storedKeys.has(key), `fixture must populate ${key}`).toBe(true);
    }

    const player = buildPlayerFacingScenarioParticipant(stored);

    const playerKeys = keysAnywhere(player);
    for (const key of NAMED_PRIVATE_KEYS) expect(playerKeys.has(key)).toBe(false);
    expect(playerKeys.has("declarationSubmittedByUserId")).toBe(false);
    expect(JSON.stringify(player)).not.toContain("SECRET");
    expect(player.state.combatEffects?.effects[0]?.id).toBe(
      stored.state.combatEffects?.effects[0]?.id,
    );
    expect(player.state.combat.combatContext.modifierBuckets.general[0]?.value).toBe(-10);
  });

  it("does not carry a field added to an internal participant structure", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const effect = stored.state.combatEffects!.effects[0]!;
    const withFutureFields = {
      ...stored,
      futureParticipantField: "SECRET_FUTURE_PARTICIPANT",
      snapshot: { ...stored.snapshot, futureSnapshotField: "SECRET_FUTURE_SNAPSHOT" },
      state: {
        ...stored.state,
        combat: {
          ...stored.state.combat,
          combatContext: {
            ...stored.state.combat.combatContext,
            futureContextField: "SECRET_FUTURE_CONTEXT",
            modifierBuckets: {
              ...stored.state.combat.combatContext.modifierBuckets,
              general: [
                {
                  ...stored.state.combat.combatContext.modifierBuckets.general[0]!,
                  futureEntryField: "SECRET_FUTURE_ENTRY",
                },
              ],
            },
          },
          futureCombatField: "SECRET_FUTURE_COMBAT",
        },
        combatEffects: {
          ...stored.state.combatEffects!,
          effects: [{ ...effect, futureEffectField: "SECRET_FUTURE_EFFECT" }],
          events: [
            {
              ...stored.state.combatEffects!.events[0]!,
              futureEventField: "SECRET_FUTURE_EVENT",
            },
          ],
        },
        futureStateField: "SECRET_FUTURE_STATE",
      },
    } as unknown as ScenarioParticipant;

    expect(JSON.stringify(buildPlayerFacingScenarioParticipant(withFutureFields))).not.toContain(
      "SECRET",
    );
  });

  it("still satisfies the participant contract the active combat response validates", () => {
    const player = buildPlayerFacingScenarioParticipant(storedParticipantWithPrivateMaterial());

    const reparsed = scenarioParticipantSchema.parse(player);

    const reparsedKeys = keysAnywhere(reparsed);
    for (const key of NAMED_PRIVATE_KEYS) expect(reparsedKeys.has(key)).toBe(false);
  });

  it("drops the canonical lifecycle from a projected combat context", () => {
    const stored = storedParticipantWithPrivateMaterial();

    const context = buildPlayerFacingCombatContext(stored.state.combat.combatContext);

    expect(keysAnywhere(context).has("canonicalLifecycle")).toBe(false);
    expect(keysAnywhere(context).has("canonicalTransitions")).toBe(false);
  });

  it("copies only the named top-level encounter fields", () => {
    const encounter = buildPlayerFacingEncounterSession({
      projectedEncounter: {
        ...storedEncounter(),
        futureEncounterField: "SECRET_FUTURE_ENCOUNTER",
      } as unknown as EncounterSession,
    });

    expect(JSON.stringify(encounter)).not.toContain("SECRET");
    expect(encounter).not.toHaveProperty("gmPrivateClosingNote");
    expect(encounter.title).toBe("Bridge");
  });
});

describe("#502 repair: a player saving back the player-facing state", () => {
  /** The state a player now receives, as it comes back in a request body. */
  function receivedState(participant: ScenarioParticipant) {
    return scenarioParticipantStateSchema.parse(
      JSON.parse(JSON.stringify(buildPlayerFacingScenarioParticipant(participant).state)),
    );
  }

  function withEffectChange(
    state: ScenarioParticipant["state"],
    change: Record<string, unknown>,
  ): ScenarioParticipant["state"] {
    const effects = state.combatEffects ?? { effects: [], events: [] };
    return {
      ...state,
      combatEffects: {
        ...effects,
        effects: effects.effects.map((effect) => ({ ...effect, ...change })),
      },
    };
  }

  it("stores exactly the stored state when the received state is saved back unchanged", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const submittedState = receivedState(stored);

    expect(keysAnywhere(submittedState).has("canonicalTransitions")).toBe(false);
    expect(
      mergePlayerSubmittedScenarioParticipantState({ currentState: stored.state, submittedState }),
    ).toEqual(stored.state);
  });

  it("stores exactly the stored state when the stored state is saved back, as before #502", () => {
    const stored = storedParticipantWithPrivateMaterial();

    expect(
      mergePlayerSubmittedScenarioParticipantState({
        currentState: stored.state,
        submittedState: stored.state,
      }),
    ).toEqual(stored.state);
  });

  it("refuses any change to combat effects, visible or not", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const refused = (submittedState: ScenarioParticipant["state"]) =>
      mergePlayerSubmittedScenarioParticipantState({ currentState: stored.state, submittedState });

    expect(refused(withEffectChange(receivedState(stored), { modifierValue: 5 }))).toBeUndefined();
    expect(refused(withEffectChange(stored.state, { modifierValue: 5 }))).toBeUndefined();
    expect(refused(withEffectChange(stored.state, { canonicalTransitions: [] }))).toBeUndefined();
  });

  it("takes the player's visible changes and keeps the correction record of a changed entry", () => {
    const stored = storedParticipantWithPrivateMaterial();
    const submittedState = receivedState(stored);
    submittedState.combat.stance = "defensive";
    submittedState.combat.combatContext.modifierBuckets.general[0]!.value = -5;

    const merged = mergePlayerSubmittedScenarioParticipantState({
      currentState: stored.state,
      submittedState,
    });

    expect(merged?.combat.stance).toBe("defensive");
    expect(merged?.combat.combatContext.modifierBuckets.general).toEqual([
      { ...stored.state.combat.combatContext.modifierBuckets.general[0], value: -5 },
    ]);
    expect(merged?.combat.declarationSubmittedByUserId).toBe("SECRET_DECLARING_USER");
    expect(merged?.combatEffects).toEqual(stored.state.combatEffects);
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { PlayerFacingCombatContext } from "../campaign/playerFacingScenarioParticipant";
import type { ScenarioParticipantCombatContext } from "../campaign/scenario";
import { combatBreakOffProposalSchema, type CombatBreakOffProposal } from "./combatBreakOff";
import { movementIntentSchema, type MovementIntent } from "./combatMovementIntent";
import type { ContinuedContact } from "./combatOffensiveParry";
import {
  combatRoundDeclarationSchema,
  combatRoundInitiativeResultSchema,
  combatRoundParticipantStateSchema,
  combatRoundStateSchema,
  type CombatRoundCursor,
  type CombatRoundInitiativeResult,
  type CombatRoundState,
} from "./combatRoundManager";
import type { PlayerFacingCombatRoundCursor } from "./playerFacingCombatRoundCommand";
import { buildPlayerFacingCombatRoundParticipant } from "./playerFacingCombatRoundParticipant";
import {
  playerFacingCombatRoundStateSchema,
  type PlayerFacingCombatRoundState,
} from "./playerFacingCombatRoundState";
import {
  playerFacingCombatBreakOffProposalSchema,
  playerFacingCombatRoundInitiativeResultSchema,
  playerFacingContinuedContactSchema,
  playerFacingMovementIntentSchema,
} from "./playerFacingCombatRoundStructures";
import {
  playerFacingEncounterSessionSchema,
  type PlayerFacingEncounterParticipant,
  type PlayerFacingEncounterSession,
  type PlayerFacingRoleplayState,
} from "./playerFacingEncounterSession";
import {
  buildPlayerFacing,
  findWholePathViolations,
  isPlayerFacingObjectSchema,
  TIER_4_OPEN_COMMAND_FACTS,
} from "./playerFacingSchema";
import { encounterSessionSchema, type EncounterSession, type RoleplayState } from "./session";

/**
 * Forgejo #517 (privacy hardening, Tier 3): the player-facing encounter and round state are
 * whole-path — every field at every level is named by a player-facing schema — and a stored value
 * is not assignable to them at any level.
 */

type Visit = (schema: z.ZodTypeAny, path: string) => void;

/** Walks a schema through its wrappers, arrays, records and unions, visiting every schema. */
function walkSchema(schema: z.ZodTypeAny, visit: Visit, path = "$", seen = new Set()) {
  if (seen.has(schema)) return;
  seen.add(schema);
  visit(schema, path);
  const def = schema._def as Record<string, unknown>;
  if (schema instanceof z.ZodObject) {
    for (const [key, field] of Object.entries(schema.shape as z.ZodRawShape)) {
      walkSchema(field, visit, `${path}.${key}`, seen);
    }
  } else if (schema instanceof z.ZodArray) {
    walkSchema(schema.element, visit, `${path}[]`, seen);
  } else if (schema instanceof z.ZodRecord) {
    walkSchema(schema.valueSchema, visit, `${path}{}`, seen);
  } else if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) {
    for (const option of schema.options as z.ZodTypeAny[]) walkSchema(option, visit, path, seen);
  } else if (schema instanceof z.ZodEffects) {
    walkSchema(schema.innerType(), visit, path, seen);
  } else if (schema instanceof z.ZodBranded) {
    walkSchema(schema.unwrap(), visit, path, seen);
  } else if (schema instanceof z.ZodLazy) {
    walkSchema(schema.schema, visit, path, seen);
  } else if (def.innerType) {
    walkSchema(def.innerType as z.ZodTypeAny, visit, path, seen);
  }
}

/** Every key a schema names, as `path.key`, without walking a shared schema twice. */
function namedKeyPaths(schema: z.ZodTypeAny): string[] {
  const found: string[] = [];
  walkSchema(schema, (node, path) => {
    if (node instanceof z.ZodObject) {
      for (const key of Object.keys(node.shape as z.ZodRawShape)) found.push(`${path}.${key}`);
    }
  });
  return found.sort();
}

/** Every object schema reachable from `schema` that is not a player-facing one. */
function internalObjectSchemas(schema: z.ZodTypeAny): Set<z.AnyZodObject> {
  const found = new Set<z.AnyZodObject>();
  walkSchema(schema, (node) => {
    if (node instanceof z.ZodObject && !isPlayerFacingObjectSchema(node)) found.add(node);
  });
  return found;
}

/** Simulates adding an optional field to an internal schema, everywhere that schema is used. */
function addFieldInPlace(object: z.AnyZodObject, key: string): () => void {
  const def = object._def as { shape: () => z.ZodRawShape };
  const cache = object as unknown as { _cached: unknown };
  const original = def.shape;
  def.shape = () => ({ ...original(), [key]: z.string().optional() });
  cache._cached = null;
  return () => {
    def.shape = original;
    cache._cached = null;
  };
}

/** Keys whose value is a record — keyed data, not a schema's fields — in the fixture below. */
const RECORD_KEYS = new Set(["edges"]);

/** `value` with `field: "SECRET_ADDED"` on every object a schema defines, at every depth. */
function withFieldEverywhere(value: unknown, field: string, isRecord = false): unknown {
  if (Array.isArray(value)) return value.map((entry) => withFieldEverywhere(entry, field));
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, nested]) => [
      key,
      withFieldEverywhere(nested, field, RECORD_KEYS.has(key)),
    ]);
    return isRecord
      ? Object.fromEntries(entries)
      : { ...Object.fromEntries(entries), [field]: "SECRET_ADDED" };
  }
  return value;
}

const TIMESTAMP = "2026-10-06T08:00:00.000Z";

function skillContestCalculation(participantId: string) {
  return {
    baseSkill: 10,
    calculationId: `calculation-${participantId}`,
    contestType: "break_off",
    derivedIntegerAdjustment: 0,
    finalResult: 20,
    governingStat: { id: "agility", label: "Agility", value: 10 },
    openEndedDie: { openEndedD10s: [], rollD20: 10, rollTotal: 10 },
    participantId,
    preDieTotal: 10,
    role: "break_off_attacker",
    skill: { id: "dodge", label: "Dodge", totalXp: 10 },
    totalPercentageAdjustment: 0,
  };
}

/** A stored round state populating a spread of nested structures, each several levels deep. */
function storedRoundStateInput() {
  return {
    breakOffProposals: [
      {
        attackerParticipantId: "hero",
        attackerRoll: {
          calculation: skillContestCalculation("hero"),
          finalTotal: 20,
          id: "break-off-roll",
          participantId: "hero",
          rolledAt: TIMESTAMP,
        },
        escapeeParticipantId: "guard",
        gmReview: { attackerAdjustment: 1 },
        id: "break-off",
        pairKey: "guard::hero",
        result: {
          attackerObModifier: 0,
          defenderDbParryModifier: 0,
          escaped: false,
          tableRowId: "defender_1_to_5",
        },
        roundNumber: 1,
      },
    ],
    continuedContacts: [
      {
        affectedParticipantId: "guard",
        brawlingContestResultId: "brawling-result",
        controllerParticipantId: "hero",
        establishedPhase: "phase1",
        establishedRound: 1,
        id: "contact",
        sourceActionId: "offensive_parry",
        sourceAttackResultId: "attack-result",
        sourceDeclarationId: "declaration-guard",
        sourceOpportunityId: "opportunity-guard",
        sourceParryResultId: "parry-result",
        status: "active",
      },
    ],
    distanceState: {
      edges: {
        "guard::hero": {
          distance: 2,
          lastChangedRound: 1,
          pairKey: "guard::hero",
          participantAId: "guard",
          participantBId: "hero",
          source: "gm_set",
        },
      },
    },
    participants: [
      {
        declaration: {
          actionId: "attack_parry",
          intent: { facing: "forward", primaryAction: { actionId: "attack_parry" } },
          movementIntent: {
            distancePreferences: [
              {
                desiredDistance: 1,
                source: "player_declared",
                targetParticipantId: "guard",
              },
            ],
            mode: "set_distance_preferences",
          },
          roundNumber: 1,
          secondaryActionContext: { action: "observe_opponent", targetParticipantId: "guard" },
          submittedAt: TIMESTAMP,
          submittedBy: "player",
        },
        initiatives: { phase1: { baseInitiative: 2, rolls: [4], total: 6 } },
        label: "Hero",
        participantId: "hero",
      },
    ],
    roundNumber: 1,
  };
}

describe("#517 player-facing encounter: whole-path", () => {
  it("reaches no internal object schema, open value, transform or non-stripping object", () => {
    expect(findWholePathViolations(playerFacingEncounterSessionSchema)).toEqual([]);
    expect(findWholePathViolations(playerFacingCombatRoundStateSchema)).toEqual([]);
  });

  it("leaves exactly one value open: command facts, Tier 4's", () => {
    const open: string[] = [];
    walkSchema(playerFacingEncounterSessionSchema, (node, path) => {
      if (node === TIER_4_OPEN_COMMAND_FACTS) open.push(path);
    });

    expect(open).toEqual(["$.combatRoundState.commands[].facts"]);
  });

  it("names no account identity, lifecycle, correction history or GM-only field at any level", () => {
    const forbidden = namedKeyPaths(playerFacingEncounterSessionSchema).filter((path) => {
      const key = path.split(".").at(-1)!;
      return (
        /userid$|byuser|^createdby/i.test(key) ||
        [
          "canonicalLifecycle",
          "canonicalTransitions",
          "gmBacktrackHold",
          "gmOverride",
          "gmPrivateClosingNote",
          "privateDiagnostic",
        ].includes(key)
      );
    });

    expect(forbidden).toEqual([]);
  });

  it("is unchanged by a field added to every internal object schema an encounter contains", () => {
    const internal = [...internalObjectSchemas(encounterSessionSchema)];
    const playerBefore = namedKeyPaths(playerFacingEncounterSessionSchema);
    const internalBefore = namedKeyPaths(encounterSessionSchema);
    const restores = internal.map((object) => addFieldInPlace(object, "addedField"));
    try {
      // Control: every internal object schema gained the field.
      const internalAfter = namedKeyPaths(encounterSessionSchema);
      expect(internalAfter.filter((path) => path.endsWith(".addedField"))).toHaveLength(
        internal.length,
      );
      expect(internalAfter.length).toBe(internalBefore.length + internal.length);

      expect(namedKeyPaths(playerFacingEncounterSessionSchema)).toEqual(playerBefore);
    } finally {
      for (const restore of restores.reverse()) restore();
    }
    expect(internal.length).toBeGreaterThan(150);
  });

  it("carries none of a field added to every internal object schema, populated at every level", () => {
    const internal = [...internalObjectSchemas(encounterSessionSchema)];
    const restores = internal.map((object) => addFieldInPlace(object, "addedField"));
    try {
      const stored = combatRoundStateSchema.parse(
        withFieldEverywhere(storedRoundStateInput(), "addedField"),
      );
      // Control: the stored state keeps the field at every populated level.
      expect(JSON.stringify(stored).match(/SECRET_ADDED/g)?.length).toBeGreaterThan(20);

      const player = buildPlayerFacing(playerFacingCombatRoundStateSchema, stored, {
        participants: stored.participants.map((participant) =>
          buildPlayerFacingCombatRoundParticipant({ participant }),
        ),
      });

      expect(JSON.stringify(player)).not.toContain("SECRET_ADDED");
      expect(player.breakOffProposals[0]?.attackerRoll?.calculation.skill.label).toBe("Dodge");
      expect(player.participants[0]?.declaration?.movementIntent?.distancePreferences).toHaveLength(
        1,
      );
    } finally {
      for (const restore of restores.reverse()) restore();
    }
  });
});

describe("#517 Tier 2 floor QA's experiment: fields added to the movement intent and initiative result", () => {
  it("reached a player through the Tier 2 types and reaches none now", () => {
    const restoreMovement = addFieldInPlace(
      (movementIntentSchema as unknown as z.ZodEffects<z.AnyZodObject>).innerType(),
      "qaMoveSecret",
    );
    const restoreInitiative = addFieldInPlace(
      combatRoundInitiativeResultSchema as unknown as z.AnyZodObject,
      "qaInitSecret",
    );
    try {
      const stored = combatRoundParticipantStateSchema.parse({
        declaration: {
          actionId: "parry",
          movementIntent: { mode: "hold_position", qaMoveSecret: "SECRET_QA_MOVE" },
          roundNumber: 1,
          submittedAt: TIMESTAMP,
          submittedBy: "player",
        },
        initiatives: { phase1: { qaInitSecret: "SECRET_QA_INIT", rolls: [3], total: 3 } },
        label: "Hero",
        participantId: "hero",
      });
      // Control: the stored participant keeps both, and so did Tier 2's construction, which parsed
      // these fields through the canonical schemas it reused.
      expect(JSON.stringify(stored)).toContain("SECRET_QA_MOVE");
      expect(JSON.stringify(stored)).toContain("SECRET_QA_INIT");
      expect(
        JSON.stringify(
          combatRoundDeclarationSchema.shape.movementIntent.parse(
            stored.declaration?.movementIntent,
          ),
        ),
      ).toContain("SECRET_QA_MOVE");
      expect(
        JSON.stringify(
          combatRoundParticipantStateSchema.shape.initiatives.parse(stored.initiatives),
        ),
      ).toContain("SECRET_QA_INIT");

      const player = buildPlayerFacingCombatRoundParticipant({ participant: stored });

      expect(JSON.stringify(player)).not.toMatch(/SECRET_QA_(MOVE|INIT)/);
      expect(player.declaration?.movementIntent?.mode).toBe("hold_position");
      expect(player.initiatives.phase1?.total).toBe(3);
    } finally {
      restoreMovement();
      restoreInitiative();
    }
  });
});

describe("#517 player-facing encounter: non-assignability from stored values at every level", () => {
  it("rejects stored values at compile time, from the encounter down to its nested structures", () => {
    const encounter = encounterSessionSchema.parse({
      createdAt: TIMESTAMP,
      id: "encounter",
      title: "Bridge",
      updatedAt: TIMESTAMP,
    });
    const state: CombatRoundState = combatRoundStateSchema.parse(storedRoundStateInput());
    const proposal: CombatBreakOffProposal = state.breakOffProposals[0]!;
    const roll = proposal.attackerRoll!;
    const contact: ContinuedContact = state.continuedContacts[0]!;
    const movementIntent: MovementIntent = state.participants[0]!.declaration!.movementIntent!;
    const initiative = state.participants[0]!.initiatives.phase1 as CombatRoundInitiativeResult;
    const context = {} as ScenarioParticipantCombatContext;
    const cursor = {} as CombatRoundCursor;
    const encounterParticipant = {} as EncounterSession["participants"][number];
    const roleplayState = {} as RoleplayState;

    // @ts-expect-error A stored encounter is not a player-facing encounter.
    const rawEncounter: PlayerFacingEncounterSession = encounter;
    // @ts-expect-error A stored round state is not a player-facing round state.
    const rawState: PlayerFacingCombatRoundState = state;
    // @ts-expect-error A stored break-off proposal is not a player-facing one.
    const rawProposal: z.infer<typeof playerFacingCombatBreakOffProposalSchema> = proposal;
    // @ts-expect-error A stored roll is not a player-facing roll, two levels down.
    const rawRoll: z.infer<typeof playerFacingCombatBreakOffProposalSchema>["attackerRoll"] = roll;
    // @ts-expect-error A stored continued contact is not a player-facing one.
    const rawContact: z.infer<typeof playerFacingContinuedContactSchema> = contact;
    // @ts-expect-error A stored movement intent is not a player-facing one.
    const rawMovement: z.infer<typeof playerFacingMovementIntentSchema> = movementIntent;
    // @ts-expect-error A stored initiative result is not a player-facing one.
    const rawInitiative: z.infer<typeof playerFacingCombatRoundInitiativeResultSchema> = initiative;
    // @ts-expect-error A stored combat context is not a player-facing one.
    const rawContext: PlayerFacingCombatContext = context;
    // @ts-expect-error A stored cursor is not a player-facing one.
    const rawCursor: PlayerFacingCombatRoundCursor = cursor;
    // @ts-expect-error A stored encounter participant is not a player-facing one.
    const rawParticipant: PlayerFacingEncounterParticipant = encounterParticipant;
    // @ts-expect-error A stored roleplay state is not a player-facing one.
    const rawRoleplay: PlayerFacingRoleplayState = roleplayState;

    expect([
      rawEncounter,
      rawState,
      rawProposal,
      rawRoll,
      rawContact,
      rawMovement,
      rawInitiative,
      rawContext,
      rawCursor,
      rawParticipant,
      rawRoleplay,
    ]).toHaveLength(11);
  });

  it("rejects a stored value even when it has exactly the player-facing fields", () => {
    const { committedByUserId: _committed, ...sameFields } = combatBreakOffProposalSchema.parse(
      storedRoundStateInput().breakOffProposals[0],
    );

    // @ts-expect-error Field-for-field is not enough: only a player-facing schema produces the type.
    const rawProposal: z.infer<typeof playerFacingCombatBreakOffProposalSchema> = sameFields;

    expect(rawProposal).toBeDefined();
  });

  it("accepts what the player-facing schemas build", () => {
    const state = combatRoundStateSchema.parse(storedRoundStateInput());

    const player: PlayerFacingCombatRoundState = buildPlayerFacing(
      playerFacingCombatRoundStateSchema,
      state,
      {
        participants: state.participants.map((participant) =>
          buildPlayerFacingCombatRoundParticipant({ participant }),
        ),
      },
    );

    expect(player.breakOffProposals).toHaveLength(1);
  });
});

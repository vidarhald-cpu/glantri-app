import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildPlayerFacingCombatContext,
  playerFacingCombatContextSchema,
} from "../campaign/playerFacingScenarioParticipant";
import {
  scenarioParticipantCombatContextSchema,
  scenarioParticipantStateSchema,
} from "../campaign/scenario";
import {
  canonicalCombatModifierEffectSchema,
  transitionCanonicalCombatModifierEffect,
} from "./combatModifierLifecycle";
import { buildCanonicalCombatModifierReviewFromDraft } from "./combatModifierReviewProjection";
import {
  combatRoundParticipantStateSchema,
  combatRoundStateSchema,
  type CombatRoundDeclaration,
  type CombatRoundParticipantState,
} from "./combatRoundManager";
import {
  buildPlayerFacingCombatRoundParticipant,
  playerFacingCombatRoundAttackOpportunitySchema,
  playerFacingCombatRoundAttackRollResultSchema,
  playerFacingCombatRoundCombatExperienceResultSchema,
  playerFacingCombatRoundDeclarationSchema,
  playerFacingCombatRoundParticipantSchema,
  type PlayerFacingCombatRoundDeclaration,
  type PlayerFacingCombatRoundParticipant,
} from "./playerFacingCombatRoundParticipant";
import { playerFacingCombatRoundStateSchema } from "./playerFacingCombatRoundState";
import {
  buildPlayerFacingEncounterSession,
  playerFacingEncounterSessionSchema,
} from "./playerFacingEncounterSession";
import { buildPlayerFacing } from "./playerFacingSchema";
import { encounterSessionSchema, type EncounterSession } from "./session";

/**
 * Forgejo #507 (privacy hardening, Tier 2): the player-facing round-state participant and
 * declaration. The fixtures populate every field of the stored participant and declaration —
 * including each one the player types omit — so an omission is proven against populated state.
 */

/** Unwraps optional, default, branded and effect wrappers down to the schema that holds keys. */
function innerSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  for (;;) {
    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault
    ) {
      current = current._def.innerType;
    } else if (current instanceof z.ZodBranded) {
      current = current._def.type;
    } else if (current instanceof z.ZodEffects) {
      current = current._def.schema;
    } else {
      return current;
    }
  }
}

/**
 * Every key of `value` that the player-facing schema does not name, at every level the schema
 * enumerates. The allow-list is the schema itself, so a key nobody named fails by default.
 */
function keysOutsideSchema(value: unknown, schema: z.ZodTypeAny, path = "$"): string[] {
  const inner = innerSchema(schema);
  if (value === undefined || value === null) return [];
  if (inner instanceof z.ZodObject) {
    const shape = inner.shape as Record<string, z.ZodTypeAny>;
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
      if (nested === undefined) return [];
      const keySchema = shape[key];
      return keySchema
        ? keysOutsideSchema(nested, keySchema, `${path}.${key}`)
        : [`${path}.${key}`];
    });
  }
  if (inner instanceof z.ZodArray) {
    return (value as unknown[]).flatMap((entry, index) =>
      keysOutsideSchema(entry, inner.element, `${path}[${index}]`),
    );
  }
  if (inner instanceof z.ZodRecord) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
      keysOutsideSchema(nested, inner.valueSchema, `${path}{${key}}`),
    );
  }
  if (inner instanceof z.ZodUnion || inner instanceof z.ZodDiscriminatedUnion) {
    const attempts = (inner.options as z.ZodTypeAny[]).map((option) =>
      keysOutsideSchema(value, option, path),
    );
    return attempts.find((attempt) => attempt.length === 0) ?? attempts[0] ?? [];
  }
  return [];
}

function keysAnywhere(value: unknown, found: string[] = [], path = "$"): string[] {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => keysAnywhere(entry, found, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      found.push(`${path}.${key}`);
      keysAnywhere(nested, found, `${path}.${key}`);
    }
  }
  return found;
}

const ACCOUNT_IDENTITY_KEY = /UserId$|ByUser|^createdBy/;

/** A canonical lifecycle and correction-history transition built by the real engines. */
function privateModifierEntry(id: string) {
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
    createdAt: "2026-10-05T09:00:00.000Z",
    currentContext: context([]),
    draftContext: context([{ durationRounds: 2, id, scope: "until", value: -10 }]),
    encounterId: "encounter-1",
    participantState: scenarioParticipantStateSchema.parse({
      combat: {},
      equipment: {},
      health: {},
      resources: {},
    }),
    phase: "M1",
    revision: "2026-10-05T09:00:00.000Z",
    roundNumber: 3,
    scenarioParticipantId: "participant-hero",
  });
  const effect = transaction.outputEffects.find((candidate) => candidate.id === id);
  if (!effect) throw new Error("Expected a canonical effect from the review engine.");
  const transitioned = transitionCanonicalCombatModifierEffect({
    acceptedRevision: "2026-10-05T09:30:00.000Z",
    acceptedSequence: 6,
    effect,
    gmOverride: { reasonCode: "SECRET_GM_OVERRIDE_REASON", userId: "SECRET_GM_USER" },
    nextState: effect.lifecycle.state,
    privateDiagnostic: { code: "SECRET_TRANSITION_DIAGNOSTIC" },
    reason: "duration_decremented",
    transitionId: `${id}-transition`,
    transitionType: "update",
  });
  return {
    canonicalLifecycle: canonicalCombatModifierEffectSchema.parse(transitioned.effect),
    canonicalTransitions: [transitioned.transition],
    id,
    scope: "until" as const,
    value: -10,
  };
}

function privateCombatContext(id: string) {
  return scenarioParticipantCombatContextSchema.parse({
    attackModeId: "thrust",
    modifierBuckets: {
      general: [privateModifierEntry(id)],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    selectedOpponentId: "guard",
    targetParticipantId: "guard",
  });
}

function attackRollResult(input: { opportunityId: string; phase: "phase1" | "phase2" }) {
  return {
    actionId: "attack_parry",
    attackIndex: 1,
    attackModeId: "thrust",
    attackOpportunityId: input.opportunityId,
    attackPhaseDefensivePenalty: {
      activationCutoff: "phase_start",
      application: "percentage",
      attackIndex: 1,
      attackOpportunityId: input.opportunityId,
      attackProcessId: "process-attack",
      commitment: "committed",
      completeness: "complete",
      duration: "phase",
      executionState: "executed",
      id: `penalty-${input.opportunityId}`,
      participantId: "guard",
      penalty: -1,
      phase: input.phase,
      reason: "ordinary_committed_attack",
      roundNumber: 3,
      sourceException: "none",
    },
    attackSlot: "attack_1",
    attackType: "melee",
    attackerParticipantId: "guard",
    declarationId: "declaration-guard",
    defenderDb: 20,
    defenderParryModifier: 2,
    defenderParticipantId: "hero",
    grazing: false,
    hit: true,
    kind: "attackRoll",
    lookupTotal: 64,
    marginOverMissThreshold: 9,
    ob: 50,
    openEndedD10s: [],
    phase: input.phase,
    rollD20: 14,
    rollTotal: 14,
    rolledAt: "2026-10-05T09:40:00.000Z",
    rolledByUserId: "SECRET_ATTACK_ROLLER",
    tableResult: "C",
    weaponCriticalCode: "S",
    weaponName: "Spear",
    weaponSecondaryCriticalCode: "K",
    weaponSourceId: "item-spear",
    weaponTemplateId: "weapon-template-spear",
  };
}

/** A stored round-state participant with every field, kept and omitted, populated. */
function storedRoundParticipant(): CombatRoundParticipantState {
  return combatRoundParticipantStateSchema.parse({
    attackResults: {
      phase1: attackRollResult({ opportunityId: "opportunity-1", phase: "phase1" }),
    },
    attackResultsByOpportunity: {
      "opportunity-1": attackRollResult({ opportunityId: "opportunity-1", phase: "phase1" }),
    },
    characterId: "character-hero",
    combatExperience: {
      difficulty: 26,
      durationRounds: 1,
      effectiveTableTotal: 31,
      finalTotal: 31,
      label: "Steady",
      modifierValue: 0,
      needsEffectRow: false,
      note: "Holds firm.",
      resultBand: "active",
      rollD20: 11,
      rollTotal: 11,
      rolledAt: "2026-10-05T09:10:00.000Z",
      rolledByUserId: "SECRET_CE_ROLLER",
      roundNumber: 3,
      skillTotal: 20,
      skillTotalSource: "Combat Experience",
      trigger: "combat_start",
    },
    combatExperienceDue: { dueFromRoundNumber: 4, markedAtRoundNumber: 3, reason: "scheduled" },
    declaration: {
      actionId: "attack_parry",
      additionalActionNotes: "Covers the left flank.",
      adjustDistance: { currentDistance: 2, requestedDistance: 1, targetParticipantId: "guard" },
      attackOpportunities: [
        {
          actionId: "attack_parry",
          attackIndex: 1,
          attackModeId: "thrust",
          cancelledAt: "2026-10-05T09:20:00.000Z",
          cancelledByUserId: "SECRET_CANCELLING_USER",
          declarationId: "declaration-hero",
          id: "opportunity-hero-1",
          origin: "declared",
          phase: "phase1",
          slot: "attack_1",
          sourceKind: "weapon",
          status: "committed",
          targetParticipantId: "guard",
          weaponSourceId: "item-sword",
          weaponTemplateId: "weapon-template-sword",
        },
      ],
      attackPhaseDefensivePenalties: [
        {
          activationCutoff: "phase_start",
          application: "percentage",
          attackIndex: 1,
          attackOpportunityId: "opportunity-hero-1",
          attackProcessId: "process-hero",
          commitment: "committed",
          completeness: "complete",
          duration: "phase",
          executionState: "pending",
          id: "penalty-hero",
          participantId: "hero",
          penalty: -1,
          phase: "phase1",
          reason: "ordinary_committed_attack",
          roundNumber: 3,
          sourceException: "none",
        },
      ],
      combatContext: privateCombatContext("private-row"),
      disarm: {
        actingWeapon: {
          capability: "trap",
          controlRating: 3,
          itemId: "item-sword",
          itemRevision: "2026-10-05T08:00:00.000Z",
          label: "Sword",
          parryModifier: 1,
          templateId: "weapon-template-sword",
        },
        method: "proactive",
        phase: "phase1",
        targetParticipantId: "guard",
        targetWeapon: {
          capability: "none",
          controlRating: 2,
          itemId: "item-spear",
          itemRevision: "2026-10-05T08:00:00.000Z",
          label: "Spear",
          parryModifier: 0,
          templateId: "weapon-template-spear",
        },
      },
      feint: {
        attackerSkillId: "feint",
        attackerSkillLabel: "Feint",
        defenderSkillId: "perception",
        defenderSkillLabel: "Perception",
        method: "weapon",
        targetParticipantId: "guard",
      },
      id: "declaration-hero",
      intent: { facing: "forward", primaryAction: { actionId: "attack_parry" } },
      movementId: "hold",
      movementIntent: { mode: "hold_position" },
      phaseContexts: {
        phase1: privateCombatContext("private-phase1-row"),
        phase2: privateCombatContext("private-phase2-row"),
      },
      roundNumber: 3,
      secondaryActionContext: { action: "observe_opponent", targetParticipantId: "guard" },
      secondaryActionId: "observe_opponent",
      secondaryActions: [{ action: "observe_opponent", targetParticipantId: "guard" }],
      submittedAt: "2026-10-05T09:05:00.000Z",
      submittedBy: "gm",
      submittedByUserId: "SECRET_SUBMITTING_USER",
    },
    initiatives: { phase1: { baseInitiative: 2, modifierAdjustment: 1, rolls: [4], total: 7 } },
    label: "Hero",
    participantId: "hero",
    scenarioParticipantId: "participant-hero",
    stepStatuses: { select_actions: "submitted" },
  });
}

const OMITTED_DECLARATION_FIELDS = [
  "adjustDistance",
  "disarm",
  "secondaryActions",
  "submittedByUserId",
] as const;

describe("#507 player-facing round-state participant: the derived field set", () => {
  it("keeps exactly the participant and declaration fields a player consumer needs", () => {
    // The derivation, pinned: changing what a player sees about a round-state participant or
    // declaration is an edit to these lists and to the player-facing types, never a side effect.
    expect(Object.keys(playerFacingCombatRoundParticipantSchema.unwrap().shape)).toEqual([
      "attackResults",
      "attackResultsByOpportunity",
      "characterId",
      "combatExperience",
      "combatExperienceDue",
      "declaration",
      "initiatives",
      "label",
      "participantId",
      "scenarioParticipantId",
      "stepStatuses",
    ]);
    expect(Object.keys(playerFacingCombatRoundDeclarationSchema.unwrap().shape)).toEqual([
      "actionId",
      "id",
      "additionalActionNotes",
      "attackOpportunities",
      "attackPhaseDefensivePenalties",
      "combatContext",
      "feint",
      "intent",
      "movementId",
      "movementIntent",
      "phaseContexts",
      "roundNumber",
      "secondaryActionContext",
      "secondaryActionId",
      "submittedAt",
      "submittedBy",
    ]);
  });

  it("names no account identity at any level of the player-facing types", () => {
    const keysOf = (schema: z.ZodTypeAny): string[] =>
      Object.keys((innerSchema(schema) as z.ZodObject<z.ZodRawShape>).shape);
    for (const schema of [
      playerFacingCombatRoundParticipantSchema,
      playerFacingCombatRoundDeclarationSchema,
      playerFacingCombatRoundAttackRollResultSchema,
      playerFacingCombatRoundCombatExperienceResultSchema,
      playerFacingCombatRoundAttackOpportunitySchema,
    ]) {
      expect(keysOf(schema).filter((key) => ACCOUNT_IDENTITY_KEY.test(key))).toEqual([]);
    }
  });
});

describe("#507 player-facing round-state participant: additive construction", () => {
  it("carries only keys the player-facing types name, at every level", () => {
    const participant = buildPlayerFacingCombatRoundParticipant({
      participant: storedRoundParticipant(),
    });

    expect(keysOutsideSchema(participant, playerFacingCombatRoundParticipantSchema)).toEqual([]);
  });

  it("omits the declaration fields no player consumer reads although each is populated", () => {
    const stored = storedRoundParticipant();
    for (const field of OMITTED_DECLARATION_FIELDS) {
      expect(stored.declaration?.[field], `fixture populates ${field}`).toBeDefined();
    }

    const declaration = buildPlayerFacingCombatRoundParticipant({ participant: stored })
      .declaration as Record<string, unknown> | undefined;

    for (const field of OMITTED_DECLARATION_FIELDS) {
      expect(declaration, field).not.toHaveProperty(field);
    }
  });

  it("omits every account identity, nested ones included, although each is populated", () => {
    const stored = storedRoundParticipant();
    expect(keysAnywhere(stored).filter((path) => ACCOUNT_IDENTITY_KEY.test(path))).toEqual(
      expect.arrayContaining([
        "$.declaration.submittedByUserId",
        "$.declaration.attackOpportunities[0].cancelledByUserId",
        "$.attackResults.phase1.rolledByUserId",
        "$.attackResultsByOpportunity.opportunity-1.rolledByUserId",
        "$.combatExperience.rolledByUserId",
      ]),
    );

    const participant = buildPlayerFacingCombatRoundParticipant({ participant: stored });

    expect(
      keysAnywhere(participant).filter((path) =>
        ACCOUNT_IDENTITY_KEY.test(path.split(".").at(-1)!),
      ),
    ).toEqual([]);
    expect(JSON.stringify(participant)).not.toMatch(
      /SECRET_(SUBMITTING_USER|CANCELLING_USER|ATTACK_ROLLER|CE_ROLLER)/,
    );
  });

  it("drops the canonical lifecycle and correction history from every combat and phase context", () => {
    const declaration = buildPlayerFacingCombatRoundParticipant({
      participant: storedRoundParticipant(),
    }).declaration;

    for (const context of [
      declaration?.combatContext,
      declaration?.phaseContexts?.phase1,
      declaration?.phaseContexts?.phase2,
    ]) {
      expect(context).toBeDefined();
      expect(keysOutsideSchema(context, playerFacingCombatContextSchema)).toEqual([]);
    }
    expect(JSON.stringify(declaration)).not.toContain("SECRET");
  });

  it("keeps every retained value exactly as the projection produced it", () => {
    const stored = storedRoundParticipant();
    const participant = buildPlayerFacingCombatRoundParticipant({ participant: stored });
    const declaration = stored.declaration!;
    const withoutIdentity = <T extends Record<string, unknown>>(value: T, key: string) => {
      const copy: Record<string, unknown> = { ...value };
      delete copy[key];
      return copy;
    };

    expect(participant.characterId).toBe(stored.characterId);
    expect(participant.label).toBe(stored.label);
    expect(participant.participantId).toBe(stored.participantId);
    expect(participant.scenarioParticipantId).toBe(stored.scenarioParticipantId);
    expect(participant.stepStatuses).toEqual(stored.stepStatuses);
    expect(participant.initiatives).toEqual(stored.initiatives);
    expect(participant.combatExperienceDue).toEqual(stored.combatExperienceDue);
    expect(participant.combatExperience).toEqual(
      withoutIdentity(stored.combatExperience!, "rolledByUserId"),
    );
    expect(participant.attackResults.phase1).toEqual(
      withoutIdentity(stored.attackResults.phase1!, "rolledByUserId"),
    );
    expect(participant.attackResultsByOpportunity?.["opportunity-1"]).toEqual(
      withoutIdentity(stored.attackResultsByOpportunity!["opportunity-1"]!, "rolledByUserId"),
    );

    const retained = participant.declaration!;
    for (const field of [
      "actionId",
      "id",
      "additionalActionNotes",
      "attackPhaseDefensivePenalties",
      "feint",
      "intent",
      "movementId",
      "movementIntent",
      "roundNumber",
      "secondaryActionContext",
      "secondaryActionId",
      "submittedAt",
      "submittedBy",
    ] as const) {
      expect(retained[field], field).toEqual(declaration[field]);
    }
    expect(retained.attackOpportunities).toEqual(
      declaration.attackOpportunities?.map((opportunity) =>
        withoutIdentity(opportunity, "cancelledByUserId"),
      ),
    );
    expect(retained.combatContext).toEqual(
      buildPlayerFacingCombatContext(declaration.combatContext!),
    );
    expect(retained.phaseContexts).toEqual({
      phase1: buildPlayerFacingCombatContext(declaration.phaseContexts!.phase1!),
      phase2: buildPlayerFacingCombatContext(declaration.phaseContexts!.phase2!),
    });
  });

  it("does not carry an unknown key at any level the player-facing types enumerate", () => {
    // A field added to an internal schema survives the parse the projection runs, so the projected
    // participant the builder receives would carry it. Simulate that at every level the player-facing
    // types enumerate. Keys planted inside a reused canonical field schema (`feint`, `intent`,
    // `movementIntent`, `initiatives`, ...) are only an unknown key to that schema, which strips them;
    // a field actually added to that schema would be kept, so this test does not cover that case.
    const stored = storedRoundParticipant();
    const declaration = stored.declaration!;
    const withFutureFields = {
      ...stored,
      attackResults: {
        phase1: { ...stored.attackResults.phase1!, futureAttackField: "SECRET_FUTURE_ATTACK" },
      },
      attackResultsByOpportunity: {
        "opportunity-1": {
          ...stored.attackResultsByOpportunity!["opportunity-1"]!,
          futureAttackField: "SECRET_FUTURE_ATTACK",
        },
      },
      combatExperience: {
        ...stored.combatExperience!,
        futureCombatExperienceField: "SECRET_FUTURE_CE",
      },
      combatExperienceDue: { ...stored.combatExperienceDue!, futureDueField: "SECRET_FUTURE_DUE" },
      declaration: {
        ...declaration,
        attackOpportunities: [
          { ...declaration.attackOpportunities![0]!, futureOpportunityField: "SECRET_FUTURE_OPP" },
        ],
        attackPhaseDefensivePenalties: [
          {
            ...declaration.attackPhaseDefensivePenalties![0]!,
            futurePenaltyField: "SECRET_FUTURE_PENALTY",
          },
        ],
        feint: { ...declaration.feint!, futureFeintField: "SECRET_FUTURE_FEINT" },
        futureDeclarationField: "SECRET_FUTURE_DECLARATION",
        futureDeclarationUserId: "SECRET_FUTURE_DECLARATION_USER",
        intent: { ...declaration.intent!, futureIntentField: "SECRET_FUTURE_INTENT" },
        movementIntent: {
          ...declaration.movementIntent!,
          futureMovementField: "SECRET_FUTURE_MOVE",
        },
        secondaryActionContext: {
          ...declaration.secondaryActionContext!,
          futureSecondaryField: "SECRET_FUTURE_SECONDARY",
        },
      },
      futureParticipantField: "SECRET_FUTURE_PARTICIPANT",
      futureParticipantUserId: "SECRET_FUTURE_PARTICIPANT_USER",
      initiatives: {
        phase1: { ...stored.initiatives.phase1!, futureInitiativeField: "SECRET_FUTURE_INIT" },
      },
    } as unknown as CombatRoundParticipantState;

    // The Tier 1 construction this replaces, verbatim apart from the R2 flag: it spread the
    // participant and the declaration, rebuilding only the contexts. It carries the new fields.
    const tier1 = {
      ...withFutureFields,
      declaration: {
        ...withFutureFields.declaration!,
        combatContext: buildPlayerFacingCombatContext(withFutureFields.declaration!.combatContext!),
        phaseContexts: {
          phase1: buildPlayerFacingCombatContext(
            withFutureFields.declaration!.phaseContexts!.phase1!,
          ),
          phase2: buildPlayerFacingCombatContext(
            withFutureFields.declaration!.phaseContexts!.phase2!,
          ),
        },
      },
    };
    expect(JSON.stringify(tier1)).toContain("SECRET_FUTURE_PARTICIPANT");
    expect(JSON.stringify(tier1)).toContain("SECRET_FUTURE_DECLARATION");

    const participant = buildPlayerFacingCombatRoundParticipant({ participant: withFutureFields });

    expect(JSON.stringify(participant)).not.toContain("SECRET");
    expect(keysOutsideSchema(participant, playerFacingCombatRoundParticipantSchema)).toEqual([]);
  });

  it("rebuilds the combat context of every declaration: the R2 residual is removed (Tier 3)", () => {
    const stored = storedRoundParticipant();

    const declaration = buildPlayerFacingCombatRoundParticipant({
      participant: stored,
    }).declaration!;

    expect(declaration.combatContext).toEqual(
      buildPlayerFacingCombatContext(stored.declaration!.combatContext!),
    );
    expect(JSON.stringify(declaration)).not.toContain("SECRET");
    expect(() =>
      buildPlayerFacingCombatRoundParticipant({
        // @ts-expect-error The R2 opt-in no longer exists: no caller can keep a raw combat context.
        keepDeclarationCombatContextAsR2Residual: true,
        participant: stored,
      }),
    ).not.toThrow();
  });

  it("satisfies the round-state schemas the active combat response and the client parse", () => {
    const participant = buildPlayerFacingCombatRoundParticipant({
      participant: storedRoundParticipant(),
    });

    expect(() => combatRoundParticipantStateSchema.parse(participant)).not.toThrow();
  });
});

describe("#507 player-facing round-state participant: non-assignability from internal types", () => {
  it("rejects a stored participant and declaration at compile time", () => {
    const stored = storedRoundParticipant();
    const declaration: CombatRoundDeclaration = stored.declaration!;

    // @ts-expect-error A stored round-state participant is not a player-facing one.
    const rawParticipant: PlayerFacingCombatRoundParticipant = stored;
    // @ts-expect-error A stored declaration is not a player-facing declaration.
    const rawDeclaration: PlayerFacingCombatRoundDeclaration = declaration;

    expect([rawParticipant, rawDeclaration]).toHaveLength(2);
  });

  it("rejects a stored declaration even when its omitted fields are removed", () => {
    const {
      adjustDistance: _adjustDistance,
      disarm: _disarm,
      secondaryActions: _secondaryActions,
      submittedByUserId: _submittedByUserId,
      ...sameFields
    } = storedRoundParticipant().declaration!;

    // @ts-expect-error Field-for-field is not enough; only the builder produces the type.
    const rawDeclaration: PlayerFacingCombatRoundDeclaration = sameFields;

    expect(rawDeclaration).toBeDefined();
  });

  it("gives the player-facing declaration no account identity to read", () => {
    const declaration = buildPlayerFacingCombatRoundParticipant({
      participant: storedRoundParticipant(),
    }).declaration!;

    // @ts-expect-error `submittedByUserId` is not a field of the player-facing declaration.
    expect(declaration.submittedByUserId).toBeUndefined();
  });
});

describe("#517 player-facing encounter: built from player-facing values only", () => {
  function storedEncounter(): EncounterSession {
    const participant = storedRoundParticipant();
    return encounterSessionSchema.parse({
      combatRoundState: combatRoundStateSchema.parse({
        currentStep: "phase_1_actions",
        encounterId: "encounter-1",
        participants: [participant],
        roundNumber: 3,
      }),
      createdAt: "2026-10-05T08:00:00.000Z",
      currentRound: 3,
      gmPrivateClosingNote: "SECRET_CLOSING_NOTE",
      id: "encounter-1",
      kind: "combat",
      participants: [],
      status: "active",
      title: "Bridge",
      updatedAt: "2026-10-05T09:50:00.000Z",
    });
  }

  it("names every field it carries at every level, and carries none of the stored private values", () => {
    const stored = storedEncounter();
    const combatRoundState = buildPlayerFacing(
      playerFacingCombatRoundStateSchema,
      stored.combatRoundState!,
      {
        participants: stored.combatRoundState!.participants.map((participant) =>
          buildPlayerFacingCombatRoundParticipant({ participant }),
        ),
      },
    );

    const encounter = buildPlayerFacingEncounterSession({
      combatRoundState,
      encounter: stored,
      itemReferences: undefined,
      participants: [],
      roleplayState: undefined,
    });

    expect(keysOutsideSchema(encounter, playerFacingEncounterSessionSchema)).toEqual([]);
    expect(JSON.stringify(encounter)).not.toContain("SECRET");
    expect(encounter.combatRoundState?.participants[0]).toEqual(
      buildPlayerFacingCombatRoundParticipant({
        participant: stored.combatRoundState!.participants[0]!,
      }),
    );
  });

  it("takes the round state, participants, roleplay state and item list only as player-facing values", () => {
    const stored = storedEncounter();

    const build = () =>
      buildPlayerFacingEncounterSession({
        // @ts-expect-error A stored round state is not a player-facing round state.
        combatRoundState: stored.combatRoundState,
        encounter: stored,
        itemReferences: undefined,
        // @ts-expect-error Stored encounter participants are not player-facing participants.
        participants: stored.participants,
        roleplayState: undefined,
      });

    // Even forced past the compiler, the values are rebuilt by their player-facing schemas.
    expect(JSON.stringify(build())).not.toContain("SECRET");
  });
});

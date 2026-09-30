import { describe, expect, it } from "vitest";

import { combatEffectSchema, combatEffectsStateSchema } from "./combatEffects";
import {
  evaluateCanonicalCombatModifierDurationAtRoundEnd,
  type CanonicalCombatModifierEffect,
} from "./combatModifierLifecycle";
import {
  attachCanonicalPersistentEffectLifecycles,
  buildCombatExperiencePersistentLifecycle,
  buildDamagePersistentLifecycle,
  buildManualPersistentLifecycle,
  isBoundedStunnedDamageEffect,
  transitionPersistentCombatEffect,
  type PersistentCombatModifierCreationContext,
} from "./combatPersistentModifierLifecycle";
import { getCriticalEffectStoredDurationRounds } from "./criticalEffectProposal";
import { CRITICAL_EFFECT_TEMPLATES } from "./criticalEffectsTableData";
import type { CriticalEffectTemplate } from "./criticalEffectsTable";

const context: PersistentCombatModifierCreationContext = {
  commandId: "command-1",
  createdAt: "2026-08-01T08:00:00.000Z",
  createdRevision: "revision-1",
  createdSequence: 12,
  encounterId: "encounter-1",
  eventId: "event-1",
  ownerParticipantId: "participant-1",
  roundNumber: 2,
};

describe("persistent combat modifier producers", () => {
  it("makes combat-start CE combat-wide with a typed duration that excludes its creation round", () => {
    const lifecycle = buildCombatExperiencePersistentLifecycle({
      context,
      durationRounds: 4,
      effectId: "ce-1",
      modifierValue: -2,
      status: "active",
    });

    expect(lifecycle).toMatchObject({
      applicability: { combatWide: true, rollPurposes: [] },
      lifecycle: {
        duration: {
          creationRoundCounts: false,
          kind: "rounds",
          remaining: 4,
          transitionBoundary: "round_end_review",
        },
        state: "active",
      },
      payload: {
        category: "general_fatigue",
        kind: "numeric",
        unit: "percentage",
        value: -2,
      },
      provenanceCompleteness: "complete",
      sourceFamily: "combat_experience",
    });
  });

  it("keeps phase CE phase-scoped rather than combat-wide", () => {
    expect(
      buildCombatExperiencePersistentLifecycle({
        context,
        durationRounds: 1,
        effectId: "ce-phase-1",
        modifierValue: -1,
        phase: "phase2",
        status: "active",
      }).applicability,
    ).toMatchObject({ combatWide: false, phase: "phase2", roundNumber: 2 });
  });

  it("stores producer-owned Stunned as a typed restriction with an exact round count", () => {
    const lifecycle = buildDamagePersistentLifecycle({
      combatModifierBucket: "general",
      context,
      durationRounds: 2,
      effectId: "stunned-1",
      isStunned: true,
      label: "Stunned",
      modifierValue: -4,
      status: "active",
      type: "general_modifier",
    });

    expect(lifecycle).toMatchObject({
      lifecycle: { duration: { kind: "rounds", remaining: 2 } },
      payload: {
        effectKind: "stunned",
        kind: "restriction",
        operationalRestriction: "limited_action",
      },
      publicLabel: "Stunned",
      sourceFamily: "stunned",
    });
    expect(lifecycle?.payload).not.toHaveProperty("category", "general_fatigue");
  });

  it("limits the bare numeric Stunned interpretation to the damage producer", () => {
    expect(isBoundedStunnedDamageEffect({ label: "Stunned" })).toBe(true);
    expect(isBoundedStunnedDamageEffect({ label: "General modifier", notes: "duration 2" })).toBe(
      false,
    );
  });

  it("persists typed Stunned countdown facts without inventing a recovery check", () => {
    const canonicalLifecycle = buildDamagePersistentLifecycle({
      context,
      durationRounds: 2,
      effectId: "stunned-1",
      isStunned: true,
      label: "Stunned",
      status: "active",
      type: "stun",
    });
    const effect = combatEffectSchema.parse({
      canonicalLifecycle,
      createdAt: context.createdAt,
      damage: 0,
      duration: "2",
      effectGroup: "general",
      generalDamage: 0,
      id: "stunned-1",
      sourceEventId: context.eventId,
      status: "active",
      targetParticipantId: context.ownerParticipantId,
      type: "stun",
      updatedAt: context.createdAt,
    });
    if (canonicalLifecycle?.lifecycle.duration.kind !== "rounds") {
      throw new Error("Expected a typed Stunned round duration.");
    }
    const transitioned = transitionPersistentCombatEffect({
      acceptedRevision: "revision-2",
      acceptedSequence: 13,
      commandId: "round-review-1",
      effect,
      nextDuration: {
        ...canonicalLifecycle.lifecycle.duration,
        remaining: 1,
      },
      nextState: "active",
      reason: "duration_decremented",
      transitionType: "update",
    });
    const reloaded = combatEffectSchema.parse(JSON.parse(JSON.stringify(transitioned)));

    expect(reloaded.canonicalLifecycle).toMatchObject({
      lifecycle: { duration: { kind: "rounds", remaining: 1 }, state: "active" },
      payload: { effectKind: "stunned", kind: "restriction" },
    });
    expect(reloaded.canonicalLifecycle?.lifecycle.duration).not.toHaveProperty("check");
  });

  it.each([
    ["bleed", "Bleed"],
    ["internal_bleed", "Internal bleed"],
  ] as const)(
    "keeps %s identity and cadence state out of ordinary modifier buckets",
    (type, label) => {
      const lifecycle = buildDamagePersistentLifecycle({
        context,
        effectId: `${type}-1`,
        isStunned: false,
        label,
        modifierValue: 3,
        status: "active",
        type,
      });

      expect(lifecycle).toMatchObject({
        lifecycle: { duration: { conditionKind: "effect_cleared", kind: "until_condition" } },
        payload: {
          bleedState: { accumulatedTenths: 0, initializedRound: 2 },
          category: "bleed_rate",
          contributionScope: "state",
          unit: "bleed_rate",
          value: 3,
        },
        publicLabel: label,
        sourceFamily: "bleed",
      });
    },
  );

  it("preserves exact critical result and effect keys through the canonical lifecycle", () => {
    const lifecycle = buildDamagePersistentLifecycle({
      context,
      effectId: "critical-bleed-1",
      isStunned: false,
      label: "Bleed",
      modifierValue: 5,
      sourceCritKey: "blunt|arm|12",
      sourceEffectKey: "blunt|arm|12|03",
      status: "active",
      type: "bleed",
    });

    expect(lifecycle?.sourceReferences).toMatchObject({
      effectId: "critical-bleed-1",
      resultId: "blunt|arm|12",
      rowId: "blunt|arm|12|03",
    });
  });

  it("requires manual producers to supply an explicit typed payload, duration, and applicability", () => {
    const lifecycle = buildManualPersistentLifecycle({
      applicability: { combatWide: true, encounterId: "encounter-1", rollPurposes: [] },
      context,
      duration: {
        kind: "manual",
        removableBy: "gm",
        startRound: 2,
        startSequence: 12,
      },
      effectId: "manual-1",
      payload: {
        category: "skill_ob",
        contributionScope: "calculation",
        kind: "numeric",
        unit: "percentage",
        value: 3,
      },
      publicLabel: "High ground",
      publicNote: "GM-applied combat modifier",
    });

    expect(lifecycle).toMatchObject({
      applicability: { combatWide: true },
      lifecycle: { duration: { kind: "manual" } },
      payload: { unit: "percentage", value: 3 },
      sourceFamily: "manual",
    });
  });

  it("records typed duration and bleed-state transitions and round-trips them on reload", () => {
    const canonicalLifecycle = buildDamagePersistentLifecycle({
      context,
      effectId: "bleed-1",
      isStunned: false,
      label: "Bleed",
      modifierValue: 2,
      status: "active",
      type: "bleed",
    });
    const effect = combatEffectSchema.parse({
      canonicalLifecycle,
      createdAt: context.createdAt,
      damage: 0,
      effectGroup: "bleed",
      generalDamage: 0,
      id: "bleed-1",
      modifierValue: 2,
      sourceEventId: context.eventId,
      status: "active",
      targetParticipantId: context.ownerParticipantId,
      type: "bleed",
      updatedAt: context.createdAt,
    });
    const transitioned = transitionPersistentCombatEffect({
      acceptedRevision: "revision-2",
      acceptedSequence: 13,
      commandId: "health-check-1",
      effect,
      nextPayload: {
        bleedState: {
          accumulatedTenths: 4,
          initializedRound: 2,
          lastHealthCheckRound: 2,
        },
        category: "bleed_rate",
        contributionScope: "state",
        kind: "numeric",
        unit: "bleed_rate",
        value: 1,
      },
      nextState: "active",
      reason: "bleed_state_updated",
      transitionType: "update",
    });
    const reloaded = combatEffectsStateSchema.parse(
      JSON.parse(JSON.stringify({ effects: [transitioned], events: [] })),
    );

    expect(reloaded.effects[0]?.canonicalLifecycle).toMatchObject({
      payload: { bleedState: { lastHealthCheckRound: 2 }, value: 1 },
      version: 2,
    });
    expect(reloaded.effects[0]?.canonicalTransitions).toHaveLength(1);
    expect(reloaded.effects[0]?.canonicalTransitions?.[0]).toMatchObject({
      next: { payload: { value: 1 } },
      prior: { payload: { value: 2 } },
      reason: "bleed_state_updated",
      transitionType: "update",
    });
  });

  it("attaches bounded lifecycle facts to imported typed effects without guessing manual units", () => {
    const imported = attachCanonicalPersistentEffectLifecycles({
      combatEffects: {
        effects: [
          {
            createdAt: context.createdAt,
            damage: 0,
            effectGroup: "bleed",
            generalDamage: 0,
            id: "imported-bleed",
            modifierValue: 2,
            sourceEventId: "imported-event",
            status: "active",
            targetParticipantId: context.ownerParticipantId,
            type: "internal_bleed",
            updatedAt: context.createdAt,
          },
          {
            combatModifierBucket: "general",
            createdAt: context.createdAt,
            damage: 0,
            effectGroup: "general",
            generalDamage: 0,
            id: "ambiguous-manual",
            modifierValue: -2,
            sourceEventId: "manual-event",
            status: "active",
            targetParticipantId: context.ownerParticipantId,
            type: "general_modifier",
            updatedAt: context.createdAt,
          },
        ],
        events: [
          {
            createdAt: context.createdAt,
            description: "Imported internal bleed",
            id: "imported-event",
            sourceLabel: "Imported condition",
            sourceType: "manual",
            targetParticipantId: context.ownerParticipantId,
          },
          {
            createdAt: context.createdAt,
            description: "Legacy manual row",
            id: "manual-event",
            sourceLabel: "Manual modifier",
            sourceType: "manual",
            targetParticipantId: context.ownerParticipantId,
          },
        ],
      },
    });

    expect(imported.effects[0]?.canonicalLifecycle).toMatchObject({
      payload: { category: "bleed_rate", unit: "bleed_rate", value: 2 },
      provenanceCompleteness: "legacy_incomplete",
      sourceFamily: "bleed",
    });
    expect(imported.effects[1]?.canonicalLifecycle).toBeUndefined();
  });
});

/**
 * Executable creation-boundary coverage for the damage producer.
 *
 * The producer's own `creationRoundCounts` flag is only meaningful once it is driven through the
 * shared Round End transition engine, so these tests assert the observable lifetime rather than
 * the emitted flag. Each one fails if the damage producer stops excluding its creation round, and
 * the Critical cases additionally fail if the retired next-round compatibility tick is restored.
 */
function findCriticalEffectTemplate(effectKey: string): CriticalEffectTemplate {
  const template = (CRITICAL_EFFECT_TEMPLATES as CriticalEffectTemplate[]).find(
    (candidate) => candidate.effectKey === effectKey,
  );

  if (!template) {
    throw new Error(`Critical effect template ${effectKey} is missing from the table.`);
  }

  return template;
}

function walkRoundEndsFromCreation(input: {
  createdInRound: number;
  lifecycle: CanonicalCombatModifierEffect | undefined;
  throughRounds: number;
}): { expiredAtRound: number | undefined; outcomesByRound: string[] } {
  let duration = input.lifecycle?.lifecycle.duration;

  if (!duration) {
    throw new Error("The damage producer emitted no canonical duration to advance.");
  }

  const outcomesByRound: string[] = [];

  for (
    let roundNumber = input.createdInRound;
    roundNumber < input.createdInRound + input.throughRounds;
    roundNumber += 1
  ) {
    const outcome = evaluateCanonicalCombatModifierDurationAtRoundEnd({ duration, roundNumber });

    if (outcome.kind === "hold") {
      outcomesByRound.push(`R${roundNumber}: hold`);
      continue;
    }

    if (outcome.kind === "decrement") {
      duration = outcome.nextDuration;
      outcomesByRound.push(
        `R${roundNumber}: decrement to ${"remaining" in duration ? duration.remaining : "?"}`,
      );
      continue;
    }

    if (outcome.kind === "expire") {
      outcomesByRound.push(`R${roundNumber}: expire`);

      return { expiredAtRound: roundNumber, outcomesByRound };
    }

    throw new Error(`Unexpected round-clock outcome ${outcome.kind}.`);
  }

  return { expiredAtRound: undefined, outcomesByRound };
}

describe("damage producer creation-boundary lifetime", () => {
  it("keeps a one-round damage effect alive through its own creation Round End", () => {
    const walk = walkRoundEndsFromCreation({
      createdInRound: context.roundNumber,
      lifecycle: buildDamagePersistentLifecycle({
        combatModifierBucket: "general",
        context,
        durationRounds: 1,
        effectId: "damage-one-round",
        isStunned: false,
        label: "One round penalty",
        modifierValue: -10,
        rowCategory: "general_modifier",
        status: "active",
        type: "general_modifier",
      }),
      throughRounds: 6,
    });

    expect(walk.outcomesByRound).toEqual(["R2: hold", "R3: expire"]);
    expect(walk.expiredAtRound).toBe(context.roundNumber + 1);
  });

  it("gives a two-round damage effect two full rounds after the round it was created in", () => {
    const walk = walkRoundEndsFromCreation({
      createdInRound: context.roundNumber,
      lifecycle: buildDamagePersistentLifecycle({
        combatModifierBucket: "general",
        context,
        durationRounds: 2,
        effectId: "damage-two-rounds",
        isStunned: false,
        label: "Two round penalty",
        modifierValue: -10,
        rowCategory: "general_modifier",
        status: "active",
        type: "general_modifier",
      }),
      throughRounds: 6,
    });

    expect(walk.outcomesByRound).toEqual(["R2: hold", "R3: decrement to 1", "R4: expire"]);
    expect(walk.expiredAtRound).toBe(context.roundNumber + 2);
  });

  it("expires a committed next-round Critical penalty at the end of that next round", () => {
    // `sharp|head|01|01` is a real numeric DB penalty whose source duration is one next round.
    const template = findCriticalEffectTemplate("sharp|head|01|01");
    const storedDurationRounds = getCriticalEffectStoredDurationRounds(template, []);

    expect(template.durationRaw).toBe("next round; parry only next round");
    expect(storedDurationRounds).toBe(1);

    const walk = walkRoundEndsFromCreation({
      createdInRound: context.roundNumber,
      lifecycle: buildDamagePersistentLifecycle({
        combatModifierBucket: "db_parry",
        context,
        durationRounds: storedDurationRounds,
        effectId: "critical-next-round",
        isStunned: false,
        label: "Balance or stance",
        modifierValue: template.penaltyPct,
        rowCategory: "db_modifier",
        sourceCritKey: template.critKey,
        sourceEffectKey: template.effectKey,
        status: "active",
        type: "db_modifier",
      }),
      throughRounds: 6,
    });

    expect(walk.outcomesByRound).toEqual(["R2: hold", "R3: expire"]);
    expect(walk.expiredAtRound).toBe(context.roundNumber + 1);
  });

  it("expires a rolled next-D6 Critical penalty exactly its rolled number of rounds later", () => {
    const template: CriticalEffectTemplate = {
      critKey: "test|head|01",
      durationMode: "roll",
      durationRaw: "no actions for the next D6 rounds",
      durationRoll: "d6",
      effectKey: "test|head|01|01",
      effectOrder: 1,
      group: "Stun/Action",
      rateMode: "none",
      subtype: "shock_or_action_lock",
      target: "general_action",
      type: "Stun",
      urgency: 1,
    };
    const storedDurationRounds = getCriticalEffectStoredDurationRounds(template, [
      {
        effectKey: template.effectKey,
        formula: "d6",
        purpose: "duration",
        rolls: [3],
        sourceField: "durationRoll",
        total: 3,
      },
    ]);

    expect(storedDurationRounds).toBe(3);

    const walk = walkRoundEndsFromCreation({
      createdInRound: context.roundNumber,
      lifecycle: buildDamagePersistentLifecycle({
        context,
        durationRounds: storedDurationRounds,
        effectId: "critical-next-d6",
        isStunned: true,
        label: "Stunned",
        notes: "No combat action possible while stunned.",
        rowCategory: "no_combat_action",
        sourceCritKey: template.critKey,
        sourceEffectKey: template.effectKey,
        status: "active",
        type: "special",
      }),
      throughRounds: 8,
    });

    expect(walk.outcomesByRound).toEqual([
      "R2: hold",
      "R3: decrement to 2",
      "R4: decrement to 1",
      "R5: expire",
    ]);
    expect(walk.expiredAtRound).toBe(context.roundNumber + 3);
  });
});

import { describe, expect, it } from "vitest";

import { scenarioParticipantCombatContextSchema } from "../campaign/scenario";
import {
  ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID,
  DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID,
  DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID,
  PARRY_ROUND_PERCENTAGE_MODIFIER_ID,
  REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID,
  applyCombatActionGeneratedModifiers as applyCanonicalCombatActionGeneratedModifiers,
  cancelDoubleAttackPhase2GeneratedModifiers,
  continueDoubleAttackPhase2GeneratedModifiers,
  buildReactiveAttackPhase2GeneratedInitiativeModifier,
  getSingleAttackDeclaredDistanceForPenalty,
  isAdjustRangeAttackGeneratedDbParryModifier,
  isAttackParryGeneratedDbParryModifier,
  isDistanceGeneratedObSkillModifier,
  isDoubleAttackGeneratedDbParryModifier,
  isDoubleAttackGeneratedObSkillModifier,
  isParryAttackGeneratedDbParryModifier,
  isParryGeneratedPercentageModifier,
  isReactiveAttackGeneratedInitiativeModifier,
} from "./combatActionModifiers";
import { resolveCombatAttackPhaseDefensivePenalties } from "./combatAttackPhasePenalty";

function applyCombatActionGeneratedModifiers(
  input: Parameters<typeof applyCanonicalCombatActionGeneratedModifiers>[0],
) {
  const phases =
    input.actionId === "attack_parry"
      ? (["phase1"] as const)
      : input.actionId === "parry_attack" ||
          input.actionId === "feint_attack" ||
          input.actionId === "adjust_range_attack"
        ? (["phase2"] as const)
        : input.actionId === "double_attack"
          ? (["phase1", "phase2"] as const)
          : [];
  const participantId = "test-participant";
  return applyCanonicalCombatActionGeneratedModifiers({
    ...input,
    attackPhaseDefensivePenalties:
      input.attackPhaseDefensivePenalties ??
      resolveCombatAttackPhaseDefensivePenalties({
        commitment: "committed",
        opportunities: phases.map((phase) => ({
          actionId: input.actionId,
          id: `test:${participantId}:${phase}`,
          phase,
          slot: phase === "phase1" ? "attack_1" : "attack_2",
          status: "committed",
        })),
        participantId,
        roundNumber: input.sourceRoundNumber ?? 1,
      }),
  });
}

describe("combat action generated modifiers", () => {
  it("creates one round-scoped Parry percentage modifier with Dodge provenance", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      parryModifier: { dodgeSkillValue: 17, percentageModifier: 3 },
      sourceRoundNumber: 4,
    });

    expect(context.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        application: "percentage",
        expiresAtRound: 4,
        id: PARRY_ROUND_PERCENTAGE_MODIFIER_ID,
        notes: "Parry: Dodge 17; one fifth, rounded down; Parry +3%",
        sourceActionId: "parry",
        value: 3,
      }),
    ]);
  });

  it("recommits Parry without duplicating its generated percentage row", () => {
    const first = applyCombatActionGeneratedModifiers({
      actionId: "parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      parryModifier: { dodgeSkillValue: 15, percentageModifier: 3 },
    });
    const recommitted = applyCombatActionGeneratedModifiers({
      actionId: "parry",
      combatContext: first,
      parryModifier: { dodgeSkillValue: 15, percentageModifier: 3 },
    });

    expect(
      recommitted.modifierBuckets.situationDb.filter(isParryGeneratedPercentageModifier),
    ).toHaveLength(1);
  });

  it("removes the Parry row when the declaration changes or is undone", () => {
    const declared = applyCombatActionGeneratedModifiers({
      actionId: "parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      parryModifier: { dodgeSkillValue: 14, percentageModifier: 2 },
      sourceRoundNumber: 4,
    });
    const cleared = applyCombatActionGeneratedModifiers({
      combatContext: declared,
      sourceRoundNumber: 4,
    });

    expect(cleared.modifierBuckets.situationDb).not.toContainEqual(
      expect.objectContaining({ id: PARRY_ROUND_PERCENTAGE_MODIFIER_ID }),
    );
  });

  it("creates one phase 1 DB/Parry modifier for Single attack", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });

    expect(context.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        application: "percentage",
        sourceOpportunityId: "test:test-participant:phase1",
        sourceActionId: "attack_parry",
        sourcePhase: "phase1",
        value: -4,
      }),
    ]);
  });

  it("does not duplicate the generated modifier when saving repeatedly", () => {
    const firstSave = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });
    const secondSave = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: firstSave,
    });

    expect(
      secondSave.modifierBuckets.situationDb.filter(isAttackParryGeneratedDbParryModifier),
    ).toHaveLength(1);
  });

  it("preserves imported persistent rows while recomputing generated rows", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          situationDb: [
            {
              generated: false,
              id: "import:character_effect:defense:db_parry",
              imported: true,
              notes: "Persistent defense",
              readOnly: true,
              sourceEffectId: "defense",
              sourceType: "character_effect",
              value: 2,
            },
          ],
        },
      }),
    });

    expect(context.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "import:character_effect:defense:db_parry",
        sourceType: "character_effect",
        value: 2,
      }),
      expect.objectContaining({ sourceOpportunityId: "test:test-participant:phase1" }),
    ]);
  });

  it("creates one phase 2 DB/Parry modifier for Reactive attack", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });

    expect(context.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        application: "percentage",
        sourceOpportunityId: "test:test-participant:phase2",
        sourceActionId: "parry_attack",
        sourcePhase: "phase2",
        sourceRule: "attack-phase-defensive-penalty:ordinary_committed_attack",
        value: -4,
      }),
    ]);
  });

  it("does not duplicate the Reactive attack modifier when saving repeatedly", () => {
    const firstSave = applyCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });
    const secondSave = applyCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      combatContext: firstSave,
    });

    expect(
      secondSave.modifierBuckets.situationDb.filter(isParryAttackGeneratedDbParryModifier),
    ).toHaveLength(1);
  });

  it("creates phase 1 and phase 2 Skill/OB and DB/Parry modifiers for Double Attack", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });

    expect(context.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        id: DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID,
        notes: "double attack",
        sourceActionId: "double_attack",
        sourcePhase: "phase1",
        sourceRule: "double-attack-ob-skill-phase1",
        value: -1,
      }),
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        id: DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID,
        notes: "double attack",
        sourceActionId: "double_attack",
        sourcePhase: "phase2",
        sourceRule: "double-attack-ob-skill-phase2",
        value: -1,
      }),
    ]);
    expect(context.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        sourceOpportunityId: "test:test-participant:phase1",
        sourceActionId: "double_attack",
        sourcePhase: "phase1",
        sourceRule: "attack-phase-defensive-penalty:ordinary_committed_attack",
        value: -4,
      }),
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        sourceOpportunityId: "test:test-participant:phase2",
        sourceActionId: "double_attack",
        sourcePhase: "phase2",
        sourceRule: "attack-phase-defensive-penalty:ordinary_committed_attack",
        value: -4,
      }),
    ]);
  });

  it("does not duplicate Double Attack generated modifiers when saving repeatedly", () => {
    const firstSave = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });
    const secondSave = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      combatContext: firstSave,
    });

    expect(
      secondSave.modifierBuckets.situationObSkill.filter(isDoubleAttackGeneratedObSkillModifier),
    ).toHaveLength(2);
    expect(
      secondSave.modifierBuckets.situationDb.filter(isDoubleAttackGeneratedDbParryModifier),
    ).toHaveLength(2);
  });

  it("creates the phase 1 DB/Parry risk only when Adjust Distance moves closer", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "adjust_range_attack",
      adjustDistance: { currentDistance: 3, requestedDistance: 2, roundNumber: 4 },
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });

    expect(context.modifierBuckets.situationDb).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          durationRounds: 1,
          generated: true,
          id: ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID,
          notes: "adjust range",
          sourceActionId: "adjust_range_attack",
          sourcePhase: "phase1",
          sourceRule: "adjust-range-phase1-db-parry",
          value: -2,
        }),
        expect.objectContaining({ sourcePhase: "phase2", value: -4 }),
      ]),
    );
    expect(
      context.modifierBuckets.situationDb.find(
        (entry) => entry.id === ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID,
      )?.expiresAtRound,
    ).toBe(4);
    expect(
      applyCombatActionGeneratedModifiers({
        actionId: "adjust_range_attack",
        adjustDistance: { currentDistance: 3, requestedDistance: 4 },
        combatContext: context,
      }).modifierBuckets.situationDb,
    ).toEqual([expect.objectContaining({ sourcePhase: "phase2", value: -4 })]);
  });

  it("does not duplicate Adjust Range - Attack generated modifiers when saving repeatedly", () => {
    const firstSave = applyCombatActionGeneratedModifiers({
      actionId: "adjust_range_attack",
      adjustDistance: { currentDistance: 3, requestedDistance: 2 },
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });
    const secondSave = applyCombatActionGeneratedModifiers({
      actionId: "adjust_range_attack",
      adjustDistance: { currentDistance: 3, requestedDistance: 2 },
      combatContext: firstSave,
    });

    expect(
      secondSave.modifierBuckets.situationDb.filter(isAdjustRangeAttackGeneratedDbParryModifier),
    ).toHaveLength(1);
  });

  it("removes the generated modifier when changing away from Single attack", () => {
    const attackParryContext = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          situationDb: [
            {
              id: "manual-db-parry",
              notes: "shield angle",
              value: 2,
            },
          ],
        },
      }),
    });

    const nextContext = applyCombatActionGeneratedModifiers({
      actionId: "observe_opponent",
      combatContext: attackParryContext,
    });

    expect(nextContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "manual-db-parry",
        notes: "shield angle",
        value: 2,
      }),
    ]);
  });

  it("removes generated rows when changing between Single attack and Reactive attack", () => {
    const attackParryContext = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          situationDb: [
            {
              id: "manual-db-parry",
              notes: "shield angle",
              value: 2,
            },
          ],
        },
      }),
    });

    const parryAttackContext = applyCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      combatContext: attackParryContext,
    });

    expect(
      parryAttackContext.modifierBuckets.situationDb.filter(isAttackParryGeneratedDbParryModifier),
    ).toHaveLength(0);
    expect(
      parryAttackContext.modifierBuckets.situationDb.filter(isParryAttackGeneratedDbParryModifier),
    ).toHaveLength(1);
    expect(parryAttackContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "manual-db-parry",
        notes: "shield angle",
        value: 2,
      }),
      expect.objectContaining({
        sourceOpportunityId: "test:test-participant:phase2",
        sourcePhase: "phase2",
      }),
    ]);
  });

  it("removes Double Attack generated rows when changing away while preserving manual rows", () => {
    const doubleAttackContext = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          situationDb: [
            {
              id: "manual-db-parry",
              notes: "shield angle",
              value: 2,
            },
          ],
          situationObSkill: [
            {
              id: "manual-ob-skill",
              notes: "bad footing",
              value: -2,
            },
          ],
        },
      }),
    });

    const nextContext = applyCombatActionGeneratedModifiers({
      actionId: "observe_opponent",
      combatContext: doubleAttackContext,
    });

    expect(nextContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "manual-db-parry",
        notes: "shield angle",
        value: 2,
      }),
    ]);
    expect(nextContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        id: "manual-ob-skill",
        notes: "bad footing",
        value: -2,
      }),
    ]);
  });

  it("removes Double Attack rows when changing to Single attack", () => {
    const doubleAttackContext = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });

    const attackParryContext = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: doubleAttackContext,
    });

    expect(
      attackParryContext.modifierBuckets.situationObSkill.filter(
        isDoubleAttackGeneratedObSkillModifier,
      ),
    ).toHaveLength(0);
    expect(
      attackParryContext.modifierBuckets.situationDb.filter(isDoubleAttackGeneratedDbParryModifier),
    ).toHaveLength(0);
    expect(
      attackParryContext.modifierBuckets.situationDb.filter(isAttackParryGeneratedDbParryModifier),
    ).toHaveLength(1);
  });

  it("removes Adjust Range - Attack generated rows when changing away while preserving manual rows", () => {
    const adjustRangeContext = applyCombatActionGeneratedModifiers({
      actionId: "adjust_range_attack",
      adjustDistance: { currentDistance: 3, requestedDistance: 2 },
      combatContext: scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          situationDb: [
            {
              id: "manual-db-parry",
              notes: "shield angle",
              value: 2,
            },
          ],
        },
      }),
    });

    const nextContext = applyCombatActionGeneratedModifiers({
      actionId: "observe_opponent",
      combatContext: adjustRangeContext,
    });

    expect(nextContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "manual-db-parry",
        notes: "shield angle",
        value: 2,
      }),
    ]);
  });

  it("removes the Reactive attack modifier when changing away from Reactive attack", () => {
    const parryAttackContext = applyCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: {
          situationDb: [
            {
              id: "manual-db-parry",
              notes: "shield angle",
              value: 2,
            },
          ],
        },
      }),
    });

    const nextContext = applyCombatActionGeneratedModifiers({
      actionId: "observe_opponent",
      combatContext: parryAttackContext,
    });

    expect(nextContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "manual-db-parry",
        notes: "shield angle",
        value: 2,
      }),
    ]);
  });

  it("creates a generated distance Skill/OB modifier during action generation", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      distanceModifiers: [
        {
          actualDistance: 3,
          phase: "phase1",
          preferredDistances: [2],
          weaponName: "Broad sword",
        },
      ],
    });

    expect(context.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        sourceOpportunityId: "test:test-participant:phase1",
        value: -4,
      }),
    ]);
    expect(context.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("Broad sword preferred 2"),
        sourceActionId: "attack_parry",
        sourcePhase: "phase1",
        sourceRule: "distance-ob-skill-phase1",
        value: -2,
      }),
    ]);
    expect(
      context.modifierBuckets.situationObSkill.reduce((sum, entry) => sum + entry.value, 0),
    ).toBe(-2);
  });

  it("does not create a distance row inside preferred range", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      distanceModifiers: [
        {
          actualDistance: 3,
          phase: "phase1",
          preferredDistances: [3],
          weaponName: "Long sword",
        },
      ],
    });

    expect(context.modifierBuckets.situationObSkill).toEqual([]);
  });

  it("uses a Single attack declared farther distance for the current distance penalty", () => {
    const declaredDistance = getSingleAttackDeclaredDistanceForPenalty({
      actionId: "attack_parry",
      movementIntent: {
        distancePreferences: [
          {
            desiredDistance: 4,
            source: "player_declared",
            targetParticipantId: "guard",
          },
        ],
        mode: "set_distance_preferences",
      },
      phase: "phase1",
      preferredDistances: [2],
      targetParticipantId: "guard",
    });
    const context = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      distanceModifiers: [
        {
          actualDistance: declaredDistance ?? 2,
          actualDistanceBasis: declaredDistance === undefined ? "current" : "declared_intent",
          phase: "phase1",
          preferredDistances: [2],
          weaponName: "Broad sword",
        },
      ],
    });

    expect(declaredDistance).toBe(4);
    expect(context.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("declared 4"),
        value: -4,
      }),
    ]);
  });

  it("does not use declared distance when Single attack remains inside weapon reach", () => {
    expect(
      getSingleAttackDeclaredDistanceForPenalty({
        actionId: "attack_parry",
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 2,
              source: "player_declared",
              targetParticipantId: "guard",
            },
          ],
          mode: "set_distance_preferences",
        },
        phase: "phase1",
        preferredDistances: [2],
        targetParticipantId: "guard",
      }),
    ).toBeUndefined();
  });

  it("creates distance penalties from the nearest preferred distance", () => {
    expect(
      applyCombatActionGeneratedModifiers({
        actionId: "attack_parry",
        combatContext: scenarioParticipantCombatContextSchema.parse({}),
        distanceModifiers: [
          {
            actualDistance: 5,
            phase: "phase1",
            preferredDistances: [3],
            weaponName: "Long sword",
          },
        ],
      }).modifierBuckets.situationObSkill[0],
    ).toMatchObject({ value: -4 });

    expect(
      applyCombatActionGeneratedModifiers({
        actionId: "attack_parry",
        combatContext: scenarioParticipantCombatContextSchema.parse({}),
        distanceModifiers: [
          {
            actualDistance: 4,
            phase: "phase1",
            preferredDistances: [1, 2],
            weaponName: "Spear",
          },
        ],
      }).modifierBuckets.situationObSkill[0],
    ).toMatchObject({ value: -4 });
  });

  it("removes stale distance rows when action generation no longer has distance input", () => {
    const withDistance = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      distanceModifiers: [
        {
          actualDistance: 3,
          phase: "phase1",
          preferredDistances: [2],
          weaponName: "Broad sword",
        },
      ],
    });
    const withoutDistance = applyCombatActionGeneratedModifiers({
      actionId: "observe_opponent",
      combatContext: withDistance,
    });

    expect(
      withoutDistance.modifierBuckets.situationObSkill.filter(isDistanceGeneratedObSkillModifier),
    ).toHaveLength(0);
  });

  it("updates distance rows deterministically without duplication", () => {
    const firstSave = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      distanceModifiers: [
        {
          actualDistance: 3,
          phase: "phase1",
          preferredDistances: [2],
          weaponName: "Broad sword",
        },
      ],
    });
    const secondSave = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: firstSave,
      distanceModifiers: [
        {
          actualDistance: 4,
          phase: "phase1",
          preferredDistances: [2],
          weaponName: "Broad sword",
        },
      ],
    });

    expect(
      secondSave.modifierBuckets.situationObSkill.filter(isDistanceGeneratedObSkillModifier),
    ).toHaveLength(1);
    expect(secondSave.modifierBuckets.situationObSkill[0]).toMatchObject({
      id: "generated:distance:phase1:ob-skill",
      value: -4,
    });
  });

  it("keeps phase 1 and phase 2 distance rows separate", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      distanceModifiers: [
        {
          actualDistance: 3,
          phase: "phase1",
          preferredDistances: [2],
          weaponName: "Broad sword",
        },
        {
          actualDistance: 5,
          phase: "phase2",
          preferredDistances: [3],
          weaponName: "Broad sword",
        },
      ],
    });

    expect(context.modifierBuckets.situationObSkill).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "generated:distance:phase1:ob-skill", value: -2 }),
        expect.objectContaining({ id: "generated:distance:phase2:ob-skill", value: -4 }),
      ]),
    );
  });

  it("cancels and restores only Double Attack's phase 2 generated rows", () => {
    const manual = { id: "manual-db", notes: "GM", scope: "until" as const, value: 3 };
    const committed = applyCombatActionGeneratedModifiers({
      actionId: "double_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({
        modifierBuckets: { situationDb: [manual] },
      }),
    });
    const cancelled = cancelDoubleAttackPhase2GeneratedModifiers(committed);

    expect(cancelled.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({ id: DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID, value: -1 }),
    ]);
    expect(cancelled.modifierBuckets.situationDb).toEqual(
      expect.arrayContaining([
        manual,
        expect.objectContaining({ sourcePhase: "phase1", value: -4 }),
        expect.objectContaining({ sourcePhase: "phase2", value: -2 }),
      ]),
    );

    const restored = continueDoubleAttackPhase2GeneratedModifiers(cancelled);
    expect(restored.modifierBuckets.situationObSkill).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID, value: -1 }),
        expect.objectContaining({ id: DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID, value: -1 }),
      ]),
    );
    expect(restored.modifierBuckets.situationDb).toEqual(
      expect.arrayContaining([
        manual,
        expect.objectContaining({ sourcePhase: "phase2", value: -4 }),
      ]),
    );
  });

  it("applies and clears the Reactive attack phase 2 Initiative modifier row", () => {
    const withReactiveInitiative = applyCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      initiativeModifiers: [
        buildReactiveAttackPhase2GeneratedInitiativeModifier({
          reason: "phase 1 attack missed; no parry needed",
          value: 6,
        }),
      ],
    });
    const withoutReactiveInitiative = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: withReactiveInitiative,
    });

    expect(withReactiveInitiative.modifierBuckets.situationInitiative).toEqual([
      expect.objectContaining({
        id: REACTIVE_ATTACK_PHASE2_INITIATIVE_MODIFIER_ID,
        notes: "reactive attack: phase 1 attack missed; no parry needed",
        sourceActionId: "parry_attack",
        sourcePhase: "phase2",
        value: 6,
      }),
    ]);
    expect(
      withReactiveInitiative.modifierBuckets.situationInitiative.filter(
        isReactiveAttackGeneratedInitiativeModifier,
      ),
    ).toHaveLength(1);
    expect(withoutReactiveInitiative.modifierBuckets.situationInitiative).toEqual([]);
  });
});

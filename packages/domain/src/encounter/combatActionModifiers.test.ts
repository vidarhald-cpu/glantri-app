import { describe, expect, it } from "vitest";

import { scenarioParticipantCombatContextSchema } from "../campaign/scenario";
import {
  ADJUST_RANGE_PHASE1_DB_PARRY_MODIFIER_ID,
  ADJUST_RANGE_PHASE2_DB_PARRY_MODIFIER_ID,
  ATTACK_PARRY_DB_PARRY_MODIFIER_ID,
  DOUBLE_ATTACK_PHASE1_DB_PARRY_MODIFIER_ID,
  DOUBLE_ATTACK_PHASE1_OB_SKILL_MODIFIER_ID,
  DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID,
  DOUBLE_ATTACK_PHASE2_OB_SKILL_MODIFIER_ID,
  PARRY_ATTACK_DB_PARRY_MODIFIER_ID,
  applyCombatActionGeneratedModifiers,
  isAdjustRangeAttackGeneratedDbParryModifier,
  isAttackParryGeneratedDbParryModifier,
  isDistanceGeneratedObSkillModifier,
  isDoubleAttackGeneratedDbParryModifier,
  isDoubleAttackGeneratedObSkillModifier,
  isParryAttackGeneratedDbParryModifier,
} from "./combatActionModifiers";

describe("combat action generated modifiers", () => {
  it("creates one phase 1 DB/Parry modifier for Attack - Parry", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "attack_parry",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });

    expect(context.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        id: ATTACK_PARRY_DB_PARRY_MODIFIER_ID,
        notes: "attack parry",
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

  it("creates one phase 2 DB/Parry modifier for Parry - Attack", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "parry_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });

    expect(context.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        id: PARRY_ATTACK_DB_PARRY_MODIFIER_ID,
        notes: "parry attack",
        sourceActionId: "parry_attack",
        sourcePhase: "phase2",
        sourceRule: "parry-attack-db-parry-phase2",
        value: -4,
      }),
    ]);
  });

  it("does not duplicate the Parry - Attack modifier when saving repeatedly", () => {
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
        id: DOUBLE_ATTACK_PHASE1_DB_PARRY_MODIFIER_ID,
        notes: "double attack",
        sourceActionId: "double_attack",
        sourcePhase: "phase1",
        sourceRule: "double-attack-db-parry-phase1",
        value: -4,
      }),
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        id: DOUBLE_ATTACK_PHASE2_DB_PARRY_MODIFIER_ID,
        notes: "double attack",
        sourceActionId: "double_attack",
        sourcePhase: "phase2",
        sourceRule: "double-attack-db-parry-phase2",
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
      secondSave.modifierBuckets.situationObSkill.filter(
        isDoubleAttackGeneratedObSkillModifier,
      ),
    ).toHaveLength(2);
    expect(
      secondSave.modifierBuckets.situationDb.filter(isDoubleAttackGeneratedDbParryModifier),
    ).toHaveLength(2);
  });

  it("creates phase 1 and phase 2 DB/Parry modifiers for Adjust Range - Attack", () => {
    const context = applyCombatActionGeneratedModifiers({
      actionId: "adjust_range_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });

    expect(context.modifierBuckets.situationDb).toEqual([
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
      expect.objectContaining({
        durationRounds: 1,
        generated: true,
        id: ADJUST_RANGE_PHASE2_DB_PARRY_MODIFIER_ID,
        notes: "adjust range attack",
        sourceActionId: "adjust_range_attack",
        sourcePhase: "phase2",
        sourceRule: "adjust-range-attack-phase2-db-parry",
        value: -4,
      }),
    ]);
  });

  it("does not duplicate Adjust Range - Attack generated modifiers when saving repeatedly", () => {
    const firstSave = applyCombatActionGeneratedModifiers({
      actionId: "adjust_range_attack",
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
    });
    const secondSave = applyCombatActionGeneratedModifiers({
      actionId: "adjust_range_attack",
      combatContext: firstSave,
    });

    expect(
      secondSave.modifierBuckets.situationDb.filter(
        isAdjustRangeAttackGeneratedDbParryModifier,
      ),
    ).toHaveLength(2);
  });

  it("removes the generated modifier when changing away from Attack - Parry", () => {
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

  it("removes generated rows when changing between Attack - Parry and Parry - Attack", () => {
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
      parryAttackContext.modifierBuckets.situationDb.filter(
        isAttackParryGeneratedDbParryModifier,
      ),
    ).toHaveLength(0);
    expect(
      parryAttackContext.modifierBuckets.situationDb.filter(
        isParryAttackGeneratedDbParryModifier,
      ),
    ).toHaveLength(1);
    expect(parryAttackContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "manual-db-parry",
        notes: "shield angle",
        value: 2,
      }),
      expect.objectContaining({
        id: PARRY_ATTACK_DB_PARRY_MODIFIER_ID,
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

  it("removes Double Attack rows when changing to Attack - Parry", () => {
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
      attackParryContext.modifierBuckets.situationDb.filter(
        isDoubleAttackGeneratedDbParryModifier,
      ),
    ).toHaveLength(0);
    expect(
      attackParryContext.modifierBuckets.situationDb.filter(
        isAttackParryGeneratedDbParryModifier,
      ),
    ).toHaveLength(1);
  });

  it("removes Adjust Range - Attack generated rows when changing away while preserving manual rows", () => {
    const adjustRangeContext = applyCombatActionGeneratedModifiers({
      actionId: "adjust_range_attack",
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

  it("removes the Parry - Attack modifier when changing away from Parry - Attack", () => {
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
});

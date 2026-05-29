import { describe, expect, it } from "vitest";

import { scenarioParticipantCombatContextSchema } from "../campaign/scenario";
import {
  ATTACK_PARRY_DB_PARRY_MODIFIER_ID,
  PARRY_ATTACK_DB_PARRY_MODIFIER_ID,
  applyCombatActionGeneratedModifiers,
  isAttackParryGeneratedDbParryModifier,
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
});

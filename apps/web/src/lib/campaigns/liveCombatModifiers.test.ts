import { describe, expect, it } from "vitest";

import type { CombatEffectsState } from "@glantri/domain";
import {
  calculateWorkbookDefensePair,
  lookupWorkbookPercentageAdjustment,
} from "@glantri/rules-engine";

import {
  applyLiveRawModifierToCombatValue,
  buildEncounterDbParryModifierCalculation,
  buildEncounterLiveCombatModifierSummary,
  buildEncounterInitiativeModifierCalculation,
  sumEncounterCombatEffectModifiers,
} from "./liveCombatModifiers";

function effect(overrides: Partial<CombatEffectsState["effects"][number]>) {
  return {
    createdAt: "2026-05-19T00:00:00.000Z",
    damage: 0,
    effectGroup: "general",
    generalDamage: 0,
    id: `effect-${overrides.type ?? "general"}-${overrides.status ?? "active"}`,
    modifierValue: -1,
    sourceEventId: "event-1",
    status: "active",
    targetParticipantId: "participant-1",
    type: "general_modifier",
    updatedAt: "2026-05-19T00:00:00.000Z",
    ...overrides,
  } satisfies CombatEffectsState["effects"][number];
}

describe("live combat modifiers", () => {
  it("sums active general and fatigue effects into General/Fatigue", () => {
    const sums = sumEncounterCombatEffectModifiers({
      effects: [
        effect({ effectGroup: "general", modifierValue: -4, type: "stun" }),
        effect({ effectGroup: "fatigue", modifierValue: -2, type: "fatigue" }),
        effect({ effectGroup: "general", modifierValue: -99, status: "resolved" }),
        effect({ effectGroup: "fatigue", modifierValue: -99, status: "expired", type: "fatigue" }),
      ],
      events: [],
    });

    expect(sums.general).toBe(-4);
    expect(sums.fatigue).toBe(-2);
    expect(sums.generalFatigue).toBe(-6);
  });

  it("keeps resolved, expired, and superseded effects out of live summaries", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatEffects: {
        effects: [
          effect({ effectGroup: "obSkill", modifierValue: 3, status: "resolved" }),
          effect({ effectGroup: "db", modifierValue: 4, status: "expired" }),
          effect({
            effectGroup: "fatigue",
            modifierValue: -5,
            status: "superseded",
            type: "fatigue",
          }),
        ],
        events: [],
      },
    });

    expect(summary.generalFatigueRaw).toBe(0);
    expect(summary.obSkillRaw).toBe(0);
    expect(summary.dbRaw).toBe(0);
  });

  it("uses the workbook percentage modifier table for live combat value adjustments", () => {
    const expectedAdjustment = lookupWorkbookPercentageAdjustment(20, 6);

    expect(expectedAdjustment).not.toBeNull();
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 20,
        rawModifier: -6,
      }),
    ).toBe(20 - expectedAdjustment!);
  });

  it("documents workbook live modifier results for zero, shield, and combined defense bases", () => {
    expect(lookupWorkbookPercentageAdjustment(0, 1)).toBe(1);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 0,
        rawModifier: -1,
      }),
    ).toBe(-1);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 0,
        rawModifier: 1,
      }),
    ).toBe(1);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 0,
        rawModifier: 3,
      }),
    ).toBe(3);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 0,
        rawModifier: 100,
      }),
    ).toBe(100);

    expect(lookupWorkbookPercentageAdjustment(14, 1)).toBe(1);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 14,
        rawModifier: -1,
      }),
    ).toBe(13);

    expect(lookupWorkbookPercentageAdjustment(15, 1)).toBe(2);
    expect(
      applyLiveRawModifierToCombatValue({
        baseValue: 15,
        rawModifier: -1,
      }),
    ).toBe(13);
  });

  it("documents previous defense overlay versus summed raw modifier strategy", () => {
    const baseDb = 10;
    const liveDbModifier = -1;
    const defenseCases = [
      {
        label: "shield-only DB",
        equipmentModifier: 5,
        expectedOverlay: 13,
        expectedSummedRaw: 14,
        expectedTheoretical: 15,
      },
      {
        label: "combined sword/shield DB",
        equipmentModifier: 6,
        expectedOverlay: 14,
        expectedSummedRaw: 15,
        expectedTheoretical: 16,
      },
    ];

    for (const testCase of defenseCases) {
      const theoreticalDefense = calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: testCase.equipmentModifier,
        toHitModifier: 0,
      });
      const previousLiveOverlay =
        theoreticalDefense == null
          ? null
          : applyLiveRawModifierToCombatValue({
              baseValue: theoreticalDefense.db,
              rawModifier: liveDbModifier,
            });
      const summedRawModifier = calculateWorkbookDefensePair({
        baseDb,
        equipmentModifier: testCase.equipmentModifier,
        rawModifiers: [{ label: "live DB", value: liveDbModifier }],
        toHitModifier: 0,
      });

      expect.soft(theoreticalDefense?.db, testCase.label).toBe(testCase.expectedTheoretical);
      expect.soft(previousLiveOverlay, testCase.label).toBe(testCase.expectedOverlay);
      expect.soft(summedRawModifier?.db, testCase.label).toBe(testCase.expectedSummedRaw);
      expect
        .soft(summedRawModifier?.fullTrace.rawModifierTotal, testCase.label)
        .toBe(testCase.equipmentModifier + liveDbModifier);
    }
  });

  it("adds manual OB/Skill and DB context totals while keeping General/Fatigue effect-owned", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatContext: {
        modifierBuckets: {
          general: [{ id: "old-general", scope: "until", value: -99 }],
          situationDb: [{ id: "manual-db", scope: "until", value: 2 }],
          situationInitiative: [{ id: "manual-initiative", scope: "until", value: 5 }],
          situationObSkill: [{ id: "manual-ob", scope: "until", value: 3 }],
        },
      },
      combatEffects: {
        effects: [
          effect({ effectGroup: "general", modifierValue: -4, type: "stun" }),
          effect({ effectGroup: "fatigue", modifierValue: -2, type: "fatigue" }),
          effect({ effectGroup: "obSkill", modifierValue: 1, type: "morale" }),
          effect({ effectGroup: "db", modifierValue: -1, type: "fear" }),
        ],
        events: [],
      },
    });

    expect(summary.generalFatigueRaw).toBe(-6);
    expect(summary.initiativeRaw).toBe(5);
    expect(summary.obSkillRaw).toBe(4);
    expect(summary.dbRaw).toBe(1);
    expect(summary.modifierNoteLabels).toEqual([
      "Gen/Fatigue",
      "Initiative",
      "OB/Skill",
      "DB/Parry",
      "Enc",
      "Equipment",
    ]);
  });

  it("traces DB/Parry from General/Fatigue plus DB/Parry only", () => {
    const calculation = buildEncounterDbParryModifierCalculation({
      baseValue: 10,
      liveModifiers: {
        dbRaw: -4,
        generalFatigueRaw: -1,
        initiativeRaw: -99,
        modifierNoteLabels: [],
        obSkillRaw: -99,
      },
    });

    expect(calculation).toMatchObject({
      baseValue: 10,
      rawModifierTotal: -5,
      percentageAdjustment: lookupWorkbookPercentageAdjustment(10, 5),
      finalValue: 10 - lookupWorkbookPercentageAdjustment(10, 5)!,
      rawModifiers: [
        { label: "General/Fatigue", value: -1 },
        { label: "DB/Parry", value: -4 },
      ],
    });
  });

  it("leaves DB/Parry unchanged when only Skill/OB or Initiative modifiers exist", () => {
    expect(
      buildEncounterDbParryModifierCalculation({
        baseValue: 10,
        liveModifiers: {
          dbRaw: 0,
          generalFatigueRaw: 0,
          initiativeRaw: -4,
          modifierNoteLabels: [],
          obSkillRaw: -4,
        },
      }),
    ).toMatchObject({
      baseValue: 10,
      finalValue: 10,
      percentageAdjustment: 0,
      rawModifierTotal: 0,
      rawModifiers: [],
    });
  });

  it("filters generated DB/Parry modifiers by source phase while keeping manual rows broad", () => {
    const combatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [
          {
            id: "manual-db-parry",
            scope: "until" as const,
            value: -1,
          },
          {
            generated: true,
            id: "generated:attack-parry:phase1:db-parry",
            scope: "until" as const,
            sourcePhase: "phase1" as const,
            value: -4,
          },
          {
            generated: true,
            id: "generated:parry-attack:phase2:db-parry",
            scope: "until" as const,
            sourcePhase: "phase2" as const,
            value: -4,
          },
        ],
        situationInitiative: [],
        situationObSkill: [],
      },
    };

    expect(buildEncounterLiveCombatModifierSummary({ combatContext }).dbRaw).toBe(-9);
    expect(buildEncounterLiveCombatModifierSummary({ combatContext, phaseKey: "phase1" }).dbRaw)
      .toBe(-5);
    expect(buildEncounterLiveCombatModifierSummary({ combatContext, phaseKey: "phase2" }).dbRaw)
      .toBe(-5);
  });

  it("applies General/Fatigue and Initiative raw modifiers to initiative through the workbook table", () => {
    const calculation = buildEncounterInitiativeModifierCalculation({
      baseInitiative: 12,
      liveModifiers: {
        dbRaw: 99,
        generalFatigueRaw: -1,
        initiativeRaw: 3,
        modifierNoteLabels: [],
        obSkillRaw: 99,
      },
    });
    const expectedAdjustment = lookupWorkbookPercentageAdjustment(12, 2);

    expect(calculation.rawModifierTotal).toBe(2);
    expect(calculation.modifierAdjustment).toBe(expectedAdjustment);
    expect(calculation.modifiedInitiative).toBe(12 + expectedAdjustment!);
  });

  it("does not apply Skill/OB to initiative", () => {
    expect(
      buildEncounterInitiativeModifierCalculation({
        baseInitiative: 0,
        liveModifiers: {
          dbRaw: 0,
          generalFatigueRaw: 0,
          initiativeRaw: 0,
          modifierNoteLabels: [],
          obSkillRaw: 100,
        },
      }),
    ).toMatchObject({
      modifiedInitiative: 0,
      modifierAdjustment: 0,
      rawModifierTotal: 0,
    });

    expect(
      buildEncounterInitiativeModifierCalculation({
        baseInitiative: 0,
        liveModifiers: {
          dbRaw: 0,
          generalFatigueRaw: -1,
          initiativeRaw: 0,
          modifierNoteLabels: [],
          obSkillRaw: 100,
        },
      }),
    ).toMatchObject({
      modifiedInitiative: -1,
      modifierAdjustment: -1,
      rawModifierTotal: -1,
    });
  });
});

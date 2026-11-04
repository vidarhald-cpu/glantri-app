import { describe, expect, it } from "vitest";

import { acceptedCombatDefenseCalculationSchema } from "./combatDefenseCalculation";

describe("accepted combat defense calculation", () => {
  it("retains one immutable canonical calculation and its exact cutoff", () => {
    const calculation = acceptedCombatDefenseCalculationSchema.parse({
      authority: "canonical_scenario_state",
      baseDb: 13,
      completeness: "complete",
      cutoffInitiativeGroupId: "round:1:phase:phase1:initiative:4",
      cutoffSequence: 7,
      dynamicContributions: [
        { id: "effect-1", label: "DB/Parry", sourceId: "effect-1", value: -4 },
      ],
      dynamicRawPercentage: -4,
      effectiveDb: 12,
      effectiveDm: 2,
      equipment: {
        equipmentModifier: 4,
        itemTemplateIds: ["weapon-1"],
        label: "Sword",
        sourceKind: "single",
      },
      flatContributions: [],
      flatDbAdjustment: 0,
      noToHitPercentageTrace: {
        baseValue: 17,
        extrapolated: false,
        extrapolatedAxes: [],
        finalValue: 17,
        percentageAdjustment: 0,
        rawModifierTotal: 0,
        rawModifiers: [
          { label: "equipment", value: 4 },
          { label: "DB/Parry", value: -4 },
        ],
      },
      participantId: "participant-1",
      percentageAdjustment: 1,
      percentageTrace: {
        baseValue: 17,
        extrapolated: false,
        extrapolatedAxes: [],
        finalValue: 16,
        percentageAdjustment: 1,
        rawModifierTotal: -2,
        rawModifiers: [
          { label: "equipment", value: 4 },
          { label: "DB/Parry", value: -4 },
          { label: "to-hit", value: -2 },
        ],
      },
      schemaVersion: 1,
      sourceSnapshotId: "scenario-participant:participant-1:snapshot:revision-1",
      toHitModifier: -2,
    });

    expect(calculation).toMatchObject({
      authority: "canonical_scenario_state",
      cutoffSequence: 7,
      dynamicRawPercentage: -4,
      effectiveDb: 12,
    });
  });

  /**
   * #922. The record states, for both adjustments it carries, whether the figure came from an
   * authored cell or from the open-ended rule. Both statements are required, so a record cannot be
   * written that leaves the question open and reads as "not extrapolated".
   */
  it("requires every recorded adjustment to state whether it was extrapolated", () => {
    const trace = {
      baseValue: 9,
      extrapolated: true,
      extrapolatedAxes: ["modifier"],
      finalValue: -11,
      percentageAdjustment: 20,
      rawModifierTotal: -20,
      rawModifiers: [{ label: "DB/Parry", value: -20 }],
    };
    const calculation = {
      authority: "canonical_scenario_state",
      baseDb: 9,
      completeness: "complete",
      cutoffSequence: 1,
      dynamicContributions: [],
      dynamicRawPercentage: -20,
      effectiveDb: -11,
      effectiveDm: 0,
      equipment: {
        equipmentModifier: 0,
        itemTemplateIds: [],
        label: "Unarmed",
        sourceKind: "unarmed",
      },
      flatContributions: [],
      flatDbAdjustment: 0,
      noToHitPercentageTrace: trace,
      participantId: "participant-1",
      percentageAdjustment: 20,
      percentageTrace: trace,
      schemaVersion: 1,
      sourceSnapshotId: "scenario-participant:participant-1:snapshot:revision-1",
      toHitModifier: 0,
    };

    expect(acceptedCombatDefenseCalculationSchema.parse(calculation)).toMatchObject({
      noToHitPercentageTrace: { extrapolated: true, extrapolatedAxes: ["modifier"] },
      percentageTrace: { extrapolated: true, extrapolatedAxes: ["modifier"] },
    });

    for (const field of ["extrapolated", "extrapolatedAxes"] as const) {
      const { [field]: _omitted, ...withoutStatement } = trace;
      expect(
        () =>
          acceptedCombatDefenseCalculationSchema.parse({
            ...calculation,
            percentageTrace: withoutStatement,
          }),
        field,
      ).toThrow();
    }
    expect(() =>
      acceptedCombatDefenseCalculationSchema.parse({
        ...calculation,
        extrapolatedAxes: undefined,
        noToHitPercentageTrace: undefined,
      }),
    ).toThrow();
  });

  it("marks the bounded historical snapshot fallback as legacy incomplete", () => {
    expect(
      acceptedCombatDefenseCalculationSchema.parse({
        authority: "legacy_combat_round_step_snapshot",
        completeness: "legacy_incomplete",
        cutoffSequence: 1,
        effectiveDb: 11,
        schemaVersion: 1,
        sourceSnapshotId: "snapshot-legacy",
      }),
    ).toMatchObject({
      authority: "legacy_combat_round_step_snapshot",
      completeness: "legacy_incomplete",
    });
  });
});

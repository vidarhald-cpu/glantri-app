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
      participantId: "participant-1",
      percentageAdjustment: 1,
      percentageTrace: {
        baseValue: 17,
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

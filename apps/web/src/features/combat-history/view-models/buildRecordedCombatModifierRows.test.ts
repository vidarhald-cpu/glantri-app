import { describe, expect, it } from "vitest";

import { buildEncounterLiveCombatModifierSummary } from "@/lib/campaigns/liveCombatModifiers";

import { buildRecordedCombatModifierRows } from "./buildRecordedCombatModifierRows";

const phase2Entry = {
  durationRounds: 1,
  generated: true,
  id: "generated:reactive-attack:phase2:skill-ob",
  notes: "reactive attack",
  scope: "until" as const,
  sourcePhase: "phase2" as const,
  value: 6,
};

const combatContext = {
  modifierBuckets: {
    general: [],
    situationDb: [
      {
        ...phase2Entry,
        id: "generated:double-attack:phase1:db",
        sourcePhase: "phase1" as const,
        value: -4,
      },
    ],
    situationInitiative: [],
    situationObSkill: [phase2Entry],
  },
};

describe("buildRecordedCombatModifierRows", () => {
  it("keeps phase-2 rows visible in post-M1 history without applying them to phase 1", () => {
    const recordedRows = buildRecordedCombatModifierRows({
      combatContext,
      currentRound: 1,
      step: "review_action_modifiers",
    });
    const phase1Totals = buildEncounterLiveCombatModifierSummary({
      combatContext,
      phaseKey: "phase1",
    });

    expect(recordedRows.find((row) => row.bucketKey === "situation_ob_skill")?.entries).toEqual([
      phase2Entry,
    ]);
    expect(phase1Totals.obSkillRaw).toBe(0);
  });

  it("records the GM-edited generated value as an immutable row input", () => {
    const editedContext = {
      ...combatContext,
      modifierBuckets: {
        ...combatContext.modifierBuckets,
        situationObSkill: [{ ...phase2Entry, value: 4 }],
      },
    };
    const recordedRows = buildRecordedCombatModifierRows({
      combatContext: editedContext,
      currentRound: 1,
      step: "review_action_modifiers",
    });

    expect(
      recordedRows.find((row) => row.bucketKey === "situation_ob_skill")?.entries[0]?.value,
    ).toBe(4);
    expect(phase2Entry.value).toBe(6);
  });

  it("records both phases at M1 and only remaining phase-2 rows at M2", () => {
    const phase1 = buildRecordedCombatModifierRows({
      combatContext,
      currentRound: 1,
      step: "review_action_modifiers",
    });
    const phase2 = buildRecordedCombatModifierRows({
      combatContext,
      currentRound: 1,
      step: "review_phase_2_modifiers",
    });

    expect(phase1.find((row) => row.bucketKey === "situation_db")?.entries).toHaveLength(1);
    expect(phase1.find((row) => row.bucketKey === "situation_ob_skill")?.entries).toEqual([
      phase2Entry,
    ]);
    expect(phase2.find((row) => row.bucketKey === "situation_db")?.entries).toEqual([]);
    expect(phase2.find((row) => row.bucketKey === "situation_ob_skill")?.entries).toEqual([
      phase2Entry,
    ]);
  });

  it("records the exact round-scoped Parry percentage row in both M1 and M2 history", () => {
    const parryEntry = {
      application: "percentage" as const,
      durationRounds: 1,
      expiresAtRound: 4,
      generated: true,
      id: "generated:parry:round:db-parry-percentage",
      notes: "Parry: Dodge 7; one fifth, rounded down; Parry +1%",
      scope: "until" as const,
      sourceActionId: "parry",
      sourceRoundNumber: 4,
      sourceRule: "parry-dodge-one-fifth",
      value: 1,
    };
    const parryContext = {
      modifierBuckets: {
        general: [],
        situationDb: [parryEntry],
        situationInitiative: [],
        situationObSkill: [],
      },
    };
    const phase1 = buildRecordedCombatModifierRows({
      combatContext: parryContext,
      currentRound: 4,
      step: "review_action_modifiers",
    });
    const phase2 = buildRecordedCombatModifierRows({
      combatContext: parryContext,
      currentRound: 4,
      step: "review_phase_2_modifiers",
    });

    expect(phase1.find((row) => row.bucketKey === "situation_db")).toMatchObject({
      entries: [parryEntry],
      total: 1,
    });
    expect(phase2.find((row) => row.bucketKey === "situation_db")).toMatchObject({
      entries: [parryEntry],
      total: 1,
    });
  });
});

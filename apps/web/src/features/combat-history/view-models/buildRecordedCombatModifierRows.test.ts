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
      { ...phase2Entry, id: "generated:double-attack:phase1:db", sourcePhase: "phase1" as const, value: -4 },
    ],
    situationInitiative: [],
    situationObSkill: [phase2Entry],
  },
};

describe("buildRecordedCombatModifierRows", () => {
  it("keeps phase-2 rows visible in post-M1 history without applying them to phase 1", () => {
    const recordedRows = buildRecordedCombatModifierRows({
      combatContext,
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
      step: "review_action_modifiers",
    });
    const phase2 = buildRecordedCombatModifierRows({
      combatContext,
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
});

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
    situationDb: [],
    situationInitiative: [],
    situationObSkill: [phase2Entry],
  },
};

describe("buildRecordedCombatModifierRows", () => {
  it("keeps phase-2 rows visible in post-M1 history without applying them to phase 1", () => {
    const recordedRows = buildRecordedCombatModifierRows({ combatContext });
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
    const recordedRows = buildRecordedCombatModifierRows({ combatContext: editedContext });

    expect(
      recordedRows.find((row) => row.bucketKey === "situation_ob_skill")?.entries[0]?.value,
    ).toBe(4);
    expect(phase2Entry.value).toBe(6);
  });
});

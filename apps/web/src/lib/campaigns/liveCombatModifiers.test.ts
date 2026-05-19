import { describe, expect, it } from "vitest";

import type { CombatEffectsState } from "@glantri/domain";
import { lookupWorkbookPercentageAdjustment } from "@glantri/rules-engine";

import {
  applyLiveRawModifierToCombatValue,
  buildEncounterLiveCombatModifierSummary,
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
          effect({ effectGroup: "fatigue", modifierValue: -5, status: "superseded", type: "fatigue" }),
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

  it("adds manual OB/Skill and DB context totals while keeping General/Fatigue effect-owned", () => {
    const summary = buildEncounterLiveCombatModifierSummary({
      combatContext: {
        modifierBuckets: {
          general: [{ id: "old-general", scope: "until", value: -99 }],
          situationDb: [{ id: "manual-db", scope: "until", value: 2 }],
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
    expect(summary.obSkillRaw).toBe(4);
    expect(summary.dbRaw).toBe(1);
    expect(summary.modifierNoteLabels).toEqual(["Gen/Fatigue", "OB/Skill", "DB", "Enc", "Equipment"]);
  });
});

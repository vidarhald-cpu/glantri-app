import { describe, expect, it } from "vitest";

import {
  buildCombatContestCalculationPresentation,
  buildCombatRollCalculationPresentation,
  formatCombatContestCalculationLines,
  formatObservationCalculationLines,
  formatCombatRollCalculationLines,
} from "./combatCalculationPresentation";

describe("combat calculation presentation", () => {
  it("formats reproducible observation facts without internal IDs or a die-type label", () => {
    const lines = formatObservationCalculationLines({
      appliedModifiers: [
        { bucket: "general_fatigue", label: "Combat Experience", value: 1 },
        { bucket: "skill_ob", label: "Fatigue", value: -1 },
      ],
      effectiveSkillValue: 22,
      finalTotal: 24,
      intelligenceValue: 11,
      intelligenceXp: 3,
      openEndedD10s: [],
      rollD20: 2,
      rollTotal: 2,
      skillId: "one-handed-edged",
      skillLabel: "One-handed edged",
      skillXp: 7,
    });

    expect(lines).toEqual([
      "Skill: One-handed edged",
      "Skill XP: 7",
      "Intelligence: 11",
      "Intelligence XP: 3",
      "Effective skill: 22",
      "Combat Experience: +1%",
      "Fatigue: -1%",
      "Roll: 2",
      "Final total: 24",
    ]);
    expect(lines.join(" ")).not.toContain("Skill ID");
    expect(lines.join(" ")).not.toContain("D20");
  });

  it("shows canonical percentage modifiers and their persisted effective skill", () => {
    const calculation = buildCombatRollCalculationPresentation({
      calculation: {
        brawlingBaseValue: 15,
        brawlingSkillXp: 928,
        characteristicAverage: 12,
        effectiveSkillValue: 18,
        finalTotal: 29,
        generalModifier: 0,
        percentageAdjustment: 3,
        percentageModifierTotal: 2,
        parryQualityModifier: 2,
        rollD20: 9,
        rollTotal: 11,
        skillModifier: 0,
      },
      label: "Scyrian cavalry guy",
    });

    expect(calculation).toMatchObject({
      effectiveSkill: 18,
      modifierTotal: 0,
      percentageAdjustment: 3,
      percentageModifierTotal: 2,
      skillValue: 15,
      total: 29,
    });
    expect(formatCombatRollCalculationLines(calculation!)).toEqual([
      "Scyrian cavalry guy",
      "Skill: 15",
      "Percentage modifiers: +2%",
      "- Parry quality: +2%",
      "Effective skill: 18",
      "Die roll: 11",
      "Total: 29",
    ]);
  });

  it("displays a zero modifier cleanly and omits zero-valued detail rows", () => {
    const calculation = buildCombatRollCalculationPresentation({
      calculation: {
        brawlingBaseValue: 18,
        finalTotal: 24,
        generalModifier: 0,
        parryQualityModifier: 0,
        rollTotal: 6,
        skillModifier: 0,
      },
      label: "The Gladiator",
    });

    expect(formatCombatRollCalculationLines(calculation!)).toEqual([
      "The Gladiator",
      "Skill: 18",
      "Modifiers: +0",
      "Effective skill: 18",
      "Die roll: 6",
      "Total: 24",
    ]);
  });

  it("shows pending modifiers without including them in effective-skill arithmetic", () => {
    const calculation = buildCombatRollCalculationPresentation({
      calculation: {
        brawlingBaseValue: 24,
        finalTotal: 36,
        generalModifier: 0,
        parryQualityModifier: 0,
        pendingModifiers: [
          {
            activationLabel: "effective after Initiative 4",
            label: "Unbalanced",
            value: -2,
          },
        ],
        rollTotal: 12,
        skillModifier: 0,
      },
      label: "Tied action",
    });

    expect(calculation).toMatchObject({ effectiveSkill: 24, modifierTotal: 0, total: 36 });
    expect(formatCombatRollCalculationLines(calculation!)).toContain(
      "- Unbalanced: -2 — effective after Initiative 4",
    );
  });

  it("shows a signed contest difference, winner, and participant-safe opponent total", () => {
    const initiatorRoll = buildCombatRollCalculationPresentation({
      calculation: {
        brawlingBaseValue: 15,
        finalTotal: 27,
        generalModifier: 0,
        parryQualityModifier: 1,
        rollTotal: 11,
        skillModifier: 0,
      },
      label: "Scyrian cavalry guy",
    });
    const responderRoll = buildCombatRollCalculationPresentation({
      calculation: {
        brawlingBaseValue: 18,
        finalTotal: 24,
        generalModifier: 0,
        parryQualityModifier: 0,
        rollTotal: 6,
        skillModifier: 0,
      },
      label: "The Gladiator",
    });
    const contest = buildCombatContestCalculationPresentation({
      consequence: "Continued contact established; The Gladiator is Unbalanced (−2%).",
      initiator: {
        label: "Scyrian cavalry guy",
        participantId: "scyrian",
        roll: initiatorRoll,
        total: 27,
      },
      responder: {
        label: "The Gladiator",
        participantId: "gladiator",
        roll: responderRoll,
        total: 24,
      },
      winnerParticipantId: "scyrian",
    });

    expect(contest.difference).toBe(3);
    expect(formatCombatContestCalculationLines({ presentation: contest })).toEqual(
      expect.arrayContaining([
        "Difference: +3 in favor of Scyrian cavalry guy",
        "Result: Scyrian cavalry guy wins",
      ]),
    );
    const playerLines = formatCombatContestCalculationLines({
      presentation: contest,
      viewerParticipantId: "scyrian",
    });
    expect(playerLines).toEqual(
      expect.arrayContaining([
        "Your roll",
        "Opponent total: 24",
        "Difference: +3 in your favor",
        "Result: You win",
      ]),
    );
    expect(playerLines).not.toContain("Die roll: 6");
  });

  it("uses the strictly-higher convention and explains a tie", () => {
    const contest = buildCombatContestCalculationPresentation({
      initiator: {
        label: "Scyrian cavalry guy",
        participantId: "scyrian",
        total: 24,
      },
      responder: {
        label: "The Gladiator",
        participantId: "gladiator",
        total: 24,
      },
    });

    expect(formatCombatContestCalculationLines({ presentation: contest })).toEqual([
      "Scyrian cavalry guy total: 24",
      "The Gladiator total: 24",
      "Difference: 0",
      "Result: Tie — no continued contact established",
    ]);
  });
});

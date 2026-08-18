import { describe, expect, it } from "vitest";

import { resolveCombatDisarmRoll } from "./resolveCombatDisarm";

const roll = { dieResult: 6, openEndedD10s: [], rollD20: 6 };

describe("resolveCombatDisarmRoll", () => {
  it("keeps Main gauche mismatch, Parry, and contact provenance separate", () => {
    const result = resolveCombatDisarmRoll({
      actingParryModifier: 2,
      actingWeaponControlRating: 1,
      calculationId: "disarm:actor",
      characteristic: { choice: "dexterity", value: 10 },
      contactQualityModifier: 2,
      opponentParticipantId: "holder",
      participantId: "actor",
      role: "actor",
      roll,
      skill: { choice: "parry", id: "parry", label: "Parry", totalXp: 5 },
      targetWeaponControlRating: 2,
    });
    expect(result).toMatchObject({
      baseSkill: 15,
      contestType: "disarm",
      governingStat: { id: "dexterity", label: "Dexterity" },
      role: "disarm_actor",
      totalPercentageAdjustment: 1,
    });
    expect(result.percentageContributions.map(({ label, value }) => [label, value])).toEqual([
      ["Weapon-control mismatch", -3],
      ["Acting weapon Parry", 2],
      ["Contact quality", 2],
    ]);
  });

  it("caps the combined source adjustment at +4 and does not grant heavier-weapon bonus", () => {
    const result = resolveCombatDisarmRoll({
      actingParryModifier: 2,
      actingWeaponControlRating: 6,
      calculationId: "disarm:cap",
      characteristic: { choice: "strength", value: 10 },
      contactQualityModifier: 4,
      opponentParticipantId: "holder",
      participantId: "actor",
      role: "actor",
      roll,
      skill: { choice: "weapon_skill", id: "fencing", label: "Fencing", totalXp: 5 },
      targetWeaponControlRating: 1,
    });
    expect(result.totalPercentageAdjustment).toBe(4);
    expect(result.percentageContributions).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Disarm source cap", value: -2 })]),
    );
  });

  it("composes typed holder Unbalanced and Stunned as independent -2 contributions", () => {
    const result = resolveCombatDisarmRoll({
      actingWeaponControlRating: 2,
      calculationId: "disarm:holder",
      characteristic: { choice: "strength", value: 13 },
      conditions: [
        { id: "unbalanced-1", kind: "unbalanced", sourceId: "contact" },
        { id: "stunned-1", kind: "stunned", sourceId: "critical" },
      ],
      opponentParticipantId: "actor",
      participantId: "holder",
      role: "holder",
      roll,
      skill: { choice: "weapon_skill", id: "fencing", label: "Fencing", totalXp: 4 },
      targetWeaponControlRating: 2,
    });
    expect(result).toMatchObject({ baseSkill: 17, role: "disarm_holder" });
    expect(result.totalPercentageAdjustment).toBe(-4);
    expect(result.percentageContributions.map(({ label, value }) => [label, value])).toEqual([
      ["Unbalanced resistance", -2],
      ["Stunned resistance", -2],
    ]);
  });

  it("collapses repeated same-kind conditions while retaining every source", () => {
    const result = resolveCombatDisarmRoll({
      actingWeaponControlRating: 2,
      calculationId: "disarm:deduplicated-holder",
      characteristic: { choice: "strength", value: 13 },
      conditions: [
        { id: "unbalanced-1", kind: "unbalanced", sourceId: "contact-a" },
        { id: "unbalanced-2", kind: "unbalanced", sourceId: "contact-b" },
        { id: "stunned-1", kind: "stunned", sourceId: "critical-a" },
        { id: "stunned-2", kind: "stunned", sourceId: "critical-b" },
      ],
      opponentParticipantId: "actor",
      participantId: "holder",
      role: "holder",
      roll,
      skill: { choice: "weapon_skill", id: "fencing", label: "Fencing", totalXp: 4 },
      targetWeaponControlRating: 2,
    });

    expect(result.totalPercentageAdjustment).toBe(-4);
    expect(result.percentageContributions).toMatchObject([
      { label: "Unbalanced resistance", sourceId: "contact-a|contact-b", value: -2 },
      { label: "Stunned resistance", sourceId: "critical-a|critical-b", value: -2 },
    ]);
  });

  it("rejects the normal action at a rating gap of four", () => {
    expect(() =>
      resolveCombatDisarmRoll({
        actingWeaponControlRating: 1,
        calculationId: "disarm:infeasible",
        characteristic: { choice: "strength", value: 10 },
        opponentParticipantId: "holder",
        participantId: "actor",
        role: "actor",
        roll,
        skill: { choice: "parry", id: "parry", label: "Parry", totalXp: 5 },
        targetWeaponControlRating: 5,
      }),
    ).toThrow("too difficult to control");
  });
});

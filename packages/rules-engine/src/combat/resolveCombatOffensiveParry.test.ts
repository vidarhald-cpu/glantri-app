import { describe, expect, it } from "vitest";

import type { CombatObservationRelationship } from "@glantri/domain";

import { resolveCombatOffensiveParryBrawling } from "./resolveCombatOffensiveParry";

const roll = { dieResult: 6, openEndedD10s: [], rollD20: 6 };

function relationship(input: {
  bonus: number;
  observer: string;
  target: string;
}): CombatObservationRelationship {
  return {
    bestBonus: input.bonus,
    completedAttempts: 1,
    id: `observation:${input.observer}:${input.target}`,
    observerParticipantId: input.observer,
    roundsTowardNextAttempt: 0,
    targetParticipantId: input.target,
  };
}

describe("resolveCombatOffensiveParryBrawling", () => {
  it("uses average Strength/Dexterity plus total Brawling XP and workbook percentages", () => {
    const result = resolveCombatOffensiveParryBrawling({
      calculationId: "contest:controller",
      characteristicAverage: 10,
      gmAdjustment: 1,
      observationRelationships: [
        relationship({ bonus: 3, observer: "controller", target: "responder" }),
      ],
      opponentParticipantId: "responder",
      participantId: "controller",
      parryQualityModifier: 2,
      percentageContributions: [
        {
          category: "general_fatigue",
          id: "fatigue",
          label: "Fatigue",
          unit: "percentage",
          value: -1,
        },
      ],
      purpose: "initial_offensive_parry",
      roll,
      side: "controller",
      skill: { id: "brawling", label: "Brawling", totalXp: 5 },
    });

    expect(result).toMatchObject({
      baseSkill: 15,
      contestType: "offensive_parry_brawling",
      finalResult: 24,
      governingStat: {
        id: "str_dex_average",
        label: "Strength / Dexterity average",
        value: 10,
      },
      preDieTotal: 18,
      role: "offensive_parry_controller",
      skill: { id: "brawling", label: "Brawling", totalXp: 5 },
      totalPercentageAdjustment: 2,
    });
    expect(result.percentageContributions.map((entry) => [entry.label, entry.value])).toEqual([
      ["Fatigue", -1],
      ["Parry quality", 2],
      ["GM maneuver adjustment", 1],
    ]);
    expect(result.percentageContributions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Observe Opponent" })]),
    );
    expect(result.movementBurden).toBeUndefined();
    expect(result.missingContributionPoints).not.toContain("movement_mm");
  });

  it("gives the responder one directional defensive Observe contribution", () => {
    const result = resolveCombatOffensiveParryBrawling({
      calculationId: "contest:responder",
      characteristicAverage: 10,
      observationRelationships: [
        relationship({ bonus: 2, observer: "responder", target: "controller" }),
        relationship({ bonus: 3, observer: "controller", target: "responder" }),
      ],
      opponentParticipantId: "controller",
      participantId: "responder",
      parryQualityModifier: 4,
      purpose: "initial_offensive_parry",
      roll,
      side: "responder",
      skill: { id: "brawling", label: "Brawling", totalXp: 5 },
    });

    expect(result.role).toBe("offensive_parry_responder");
    expect(result.percentageContributions).toEqual([
      expect.objectContaining({
        category: "relationship",
        label: "Observe Opponent",
        value: 2,
      }),
    ]);
    expect(result.percentageContributions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Parry quality" })]),
    );
  });

  it("does not apply Observe against an unrelated opponent", () => {
    const result = resolveCombatOffensiveParryBrawling({
      calculationId: "contest:unrelated",
      characteristicAverage: 10,
      observationRelationships: [
        relationship({ bonus: 2, observer: "responder", target: "other" }),
      ],
      opponentParticipantId: "controller",
      participantId: "responder",
      purpose: "initial_offensive_parry",
      roll,
      side: "responder",
      skill: { id: "brawling", label: "Brawling", totalXp: 5 },
    });

    expect(result.percentageContributions).toEqual([]);
  });

  it("uses the same resolver for maintenance without initial parry quality", () => {
    const controller = resolveCombatOffensiveParryBrawling({
      calculationId: "maintenance:controller",
      characteristicAverage: 10,
      observationRelationships: [],
      opponentParticipantId: "responder",
      participantId: "controller",
      parryQualityModifier: 4,
      purpose: "continued_contact_maintenance",
      roll,
      side: "controller",
      skill: { id: "brawling", label: "Brawling", totalXp: 5 },
    });
    const responder = resolveCombatOffensiveParryBrawling({
      calculationId: "maintenance:responder",
      characteristicAverage: 10,
      observationRelationships: [
        relationship({ bonus: 1, observer: "responder", target: "controller" }),
      ],
      opponentParticipantId: "controller",
      participantId: "responder",
      parryQualityModifier: 4,
      purpose: "continued_contact_maintenance",
      roll,
      side: "responder",
      skill: { id: "brawling", label: "Brawling", totalXp: 5 },
    });

    expect(controller).toMatchObject({
      contestType: "continued_contact_maintenance",
      role: "continued_contact_controller",
    });
    expect(controller.percentageContributions).toEqual([]);
    expect(responder).toMatchObject({
      contestType: "continued_contact_maintenance",
      role: "continued_contact_responder",
    });
    expect(responder.percentageContributions).toEqual([
      expect.objectContaining({ label: "Observe Opponent", value: 1 }),
    ]);
  });
});

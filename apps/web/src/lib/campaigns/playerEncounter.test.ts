import { describe, expect, it } from "vitest";

import {
  buildPlayerEncounterPhaseSummary,
  createEmptyPlayerEncounterCombatContext,
  evaluatePlayerEncounterParryLegality,
  getPlayerEncounterCombatModifierTotals,
  getPlayerEncounterMovementLabel,
} from "./playerEncounter";

describe("playerEncounter", () => {
  it("maps primary and secondary actions into round phases", () => {
    expect(
      buildPlayerEncounterPhaseSummary({
        actionId: "attack_parry",
        secondaryActionId: "parry_attack",
      }),
    ).toEqual({
      phaseOne: "Attack - Parry",
      phaseTwo: "Parry - Attack",
    });

    expect(
      buildPlayerEncounterPhaseSummary({
        actionId: "parry_attack",
        secondaryActionId: "attack_parry",
      }),
    ).toEqual({
      phaseOne: "Parry - Attack",
      phaseTwo: "Attack - Parry",
    });
  });

  it("leaves an empty second phase open when no secondary action is selected", () => {
    expect(
      buildPlayerEncounterPhaseSummary({
        actionId: "disarm",
        secondaryActionId: "",
      }),
    ).toEqual({
      phaseOne: "Disarm",
      phaseTwo: "Open",
    });
  });

  it("returns a stable movement label fallback", () => {
    expect(getPlayerEncounterMovementLabel("advance")).toBe("Advance");
    expect(getPlayerEncounterMovementLabel("")).toBe("Hold position");
  });

  it("derives combat modifier totals from the three modifier buckets", () => {
    expect(
      getPlayerEncounterCombatModifierTotals({
        modifierBuckets: {
          general: [
            { id: "g-1", scope: "until", value: 2 },
            { id: "g-2", scope: "save", value: -1 },
          ],
          situationDb: [{ id: "db-1", scope: "until", value: 4 }],
          situationObSkill: [{ id: "ob-1", scope: "until", value: 3 }],
        },
      }),
    ).toEqual({
      attackTotal: 4,
      defenseTotal: 5,
      generalTotal: 1,
      situationDbTotal: 4,
      situationObSkillTotal: 3,
    });
  });

  it("treats off-hand or shield parry as legal for attack-parry when they cover the incoming side", () => {
    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: false,
        hasShield: true,
        hasSelectedOpponent: true,
        incomingAttackSide: "left",
        parrySource: "shield",
      }),
    ).toMatchObject({
      resolvedParrySource: "shield",
      status: "legal",
    });

    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: true,
        hasShield: false,
        hasSelectedOpponent: true,
        incomingAttackSide: "left",
        parrySource: "auto",
      }),
    ).toMatchObject({
      resolvedParrySource: "offHand",
      status: "legal",
    });
  });

  it("marks the attacking source as not legal for parry in the same phase", () => {
    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: false,
        hasShield: false,
        hasSelectedOpponent: true,
        incomingAttackSide: "front",
        parrySource: "mainHand",
      }),
    ).toMatchObject({
      resolvedParrySource: "mainHand",
      status: "not_legal",
    });

    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "offHand",
        hasOffHandWeapon: true,
        hasShield: true,
        hasSelectedOpponent: true,
        incomingAttackSide: "rear",
        parrySource: "offHand",
      }),
    ).toMatchObject({
      resolvedParrySource: "offHand",
      status: "not_legal",
    });
  });

  it("treats missing opponent selection as incomplete parry context", () => {
    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: true,
        hasShield: true,
        incomingAttackSide: "front",
        parrySource: "shield",
      }),
    ).toMatchObject({
      status: "incomplete",
    });
  });

  it("does not require incoming attack side for current player-side completeness", () => {
    expect(
      evaluatePlayerEncounterParryLegality({
        actionId: "attack_parry",
        attackSource: "mainHand",
        hasOffHandWeapon: true,
        hasShield: true,
        hasSelectedOpponent: true,
        parrySource: "shield",
      }),
    ).toMatchObject({
      resolvedParrySource: "shield",
      status: "legal",
    });
  });

  it("provides an empty persisted combat context shape", () => {
    expect(createEmptyPlayerEncounterCombatContext()).toEqual({
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationObSkill: [],
      },
    });
  });
});

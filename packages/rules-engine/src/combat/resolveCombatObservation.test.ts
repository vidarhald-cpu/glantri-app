import { describe, expect, it } from "vitest";
import type { SkillDefinition } from "@glantri/domain";

import {
  COMBAT_OBSERVATION_REQUIRED_BASIS_DATA,
  findMissingCombatObservationBasisData,
  resolveCombatObservationSkillProfile,
} from "./resolveCombatObservation";

function skill(input: { groupIds?: string[]; id: string; name: string }): SkillDefinition {
  return {
    categoryId: "combat",
    groupId: input.groupIds?.[0] ?? "combat_group",
    groupIds: input.groupIds ?? ["combat_group"],
    id: input.id,
    linkedStats: ["dex"],
    name: input.name,
  } as SkillDefinition;
}

describe("Observe Opponent skill profile", () => {
  it("uses Intelligence with canonical total skill XP and chooses the better basis", () => {
    const profile = resolveCombatObservationSkillProfile({
      sheetSummary: {
        adjustedStats: { dex: 7, int: 14 },
        draftView: {
          skills: [
            { effectiveSkillNumber: 2, skillId: "dodge", totalSkill: 9 },
            { effectiveSkillNumber: 5, skillId: "sword", totalSkill: 12 },
          ],
        },
      },
      skills: [skill({ id: "dodge", name: "Dodge" }), skill({ id: "sword", name: "Sword" })],
    });

    expect(profile).toMatchObject({
      baseValue: 19,
      skillId: "sword",
      skillLabel: "Sword",
      profile: {
        avgStats: 14,
        totalXP: 5,
      },
    });
  });
});

/**
 * #948. The required Observation data is enumerated from the rule, not from the actor's kind.
 * Observe Opponent substitutes Intelligence for the skill's linked characteristic, so the actor's
 * Intelligence value is the one datum with no rule to answer its absence.
 */
describe("#948 required Observe Opponent basis data", () => {
  const observeSkills = [
    skill({ id: "dodge", name: "Dodge" }),
    skill({ id: "sword", name: "Sword" }),
  ];

  it("enumerates exactly the Intelligence characteristic", () => {
    expect([...COMBAT_OBSERVATION_REQUIRED_BASIS_DATA]).toEqual(["intelligence_characteristic"]);
  });

  it("reports the Intelligence characteristic missing when no Stat source carries one", () => {
    const actorWithoutStats = { displayName: "NPC 3", sourceUpdatedAt: "2026-08-10T09:00:00.000Z" };

    expect(findMissingCombatObservationBasisData({ build: actorWithoutStats })).toEqual([
      "intelligence_characteristic",
    ]);
    // What the guard prevents, measured: with no Intelligence value the basis is built from a
    // substituted zero, which is the −3 recorded on #948 and is not a derived figure.
    expect(
      resolveCombatObservationSkillProfile({ build: actorWithoutStats, skills: observeSkills }),
    ).toMatchObject({ baseValue: -3, intelligenceValue: 0 });
  });

  it("reports nothing missing for a snapshot-only actor with no build, characterId, or entityId", () => {
    // Shaped like a Template/monster actor: Stats live in the persisted snapshot only.
    const templateActor = {
      displayName: "Scyrian cavalry guy",
      generatedHumanoidNpc: {
        skills: [{ skillId: "sword", targetLevel: 6 }],
        stats: { final: { dex: 9, int: 12 } },
      },
    };

    expect(findMissingCombatObservationBasisData({ build: templateActor })).toEqual([]);
    expect(
      resolveCombatObservationSkillProfile({ build: templateActor, skills: observeSkills }),
    ).toMatchObject({ intelligenceValue: 12, skillId: "sword" });
  });

  it("reports nothing missing when the basis is legitimately negative", () => {
    // Intelligence 1 and no known Observe skill: 1 + 0 − 3. A derived negative is a valid result
    // under #922 and is not missing data.
    const input = { sheetSummary: { adjustedStats: { int: 1 } } };

    expect(findMissingCombatObservationBasisData(input)).toEqual([]);
    expect(resolveCombatObservationSkillProfile({ ...input, skills: observeSkills })).toMatchObject(
      {
        baseValue: -2,
        profile: { avgStats: 1 },
      },
    );
    // Disclosed, not changed: for a sheet-summary-only actor the reported `intelligenceValue`
    // reads `baseAvgStats`, which is sourced from the build alone and so reports 0 while the basis
    // correctly uses 1. Pre-existing and outside #948; recorded in the lane report.
    expect(
      resolveCombatObservationSkillProfile({ ...input, skills: observeSkills })?.intelligenceValue,
    ).toBe(0);
  });

  it("reports the Intelligence characteristic missing when other Stats are present but Intelligence is not", () => {
    const input = { sheetSummary: { adjustedStats: { dex: 11, str: 12 } } };

    expect(findMissingCombatObservationBasisData(input)).toEqual(["intelligence_characteristic"]);
  });
});

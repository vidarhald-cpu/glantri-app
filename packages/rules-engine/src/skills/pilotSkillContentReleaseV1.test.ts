import { getPilotSkillCharacterBuildInput, pilotSkillContentReleaseV1 } from "@glantri/content";
import { describe, expect, it } from "vitest";

import {
  calculatePilotSkillBuild,
  evaluatePilotChargenBudget,
  resolvePilotSkillAccess,
  validatePilotSkillFinalization,
  type PilotSkillBuildInput,
} from "./pilotSkillRulesV1";

function calculateCharacter(characterId: string) {
  const input = getPilotSkillCharacterBuildInput(
    pilotSkillContentReleaseV1,
    characterId,
  ) as PilotSkillBuildInput;
  return { input, result: calculatePilotSkillBuild(input) };
}

describe("canonical pilot Skill content release consumption", () => {
  it("resolves all eight accepted Characters to their exact Pilot v1 costs", () => {
    const expected = [
      ["character:pilot:glantrian-retainer-veteran", 30, 49, 0],
      ["character:pilot:mogrebi-temple-physician", 20, 40, 0],
      ["character:pilot:iest-dockside-investigator", 32, 56, 0],
      ["character:pilot:olog-chancery-clerk", 30, 51, 0],
      ["character:pilot:lankhmar-weaponsmith-factor", 35, 63, 3],
      ["character:pilot:lankhmar-coastal-pilot", 40, 58, 0],
      ["character:pilot:nkolian-caravan-scout", 32, 54, 0],
      ["character:pilot:scythian-mounted-envoy", 34, 50, 0],
    ] as const;

    for (const [characterId, groupCost, totalCost, flexSpent] of expected) {
      const character = pilotSkillContentReleaseV1.characters.find(({ id }) => id === characterId)!;
      const { input, result } = calculateCharacter(characterId);
      expect(result.groupBundle.bundleCost, characterId).toBe(groupCost);
      expect(result.totalCost, characterId).toBe(totalCost);
      expect(character.expected, characterId).toEqual({ flexSpent, groupCost, totalCost });
      expect(
        evaluatePilotChargenBudget({
          configuration: { flexBudget: 26, formationBudget: 60 },
          purchases: [
            {
              access: "available",
              cost: result.totalCost,
              formationEligible: true,
              id: characterId,
            },
          ],
        }),
      ).toMatchObject({ flexSpent, valid: true });
      expect(
        validatePilotSkillFinalization({ build: result, competencies: input.competencies }),
        characterId,
      ).toEqual({ errors: [], valid: true });
    }
  });

  it("matches the accepted representative effective competencies and prerequisites", () => {
    const veteran = calculateCharacter("character:pilot:glantrian-retainer-veteran").result;
    expect(veteran.byCompetencyId["skill:sword"]?.effectiveCompetence).toBe(6);
    expect(veteran.byCompetencyId["skill:shield"]?.effectiveCompetence).toBe(6);
    expect(veteran.byCompetencyId["skill:knife-dagger"]?.effectiveCompetence).toBe(3);
    expect(
      veteran.byCompetencyId["spec:household-guard-sword-shield-drill"]?.effectiveCompetence,
    ).toBe(2);

    const physician = calculateCharacter("character:pilot:mogrebi-temple-physician").result;
    expect(physician.byCompetencyId["skill:medicine"]?.effectiveCompetence).toBe(6);
    expect(physician.byCompetencyId["skill:first-aid"]?.effectiveCompetence).toBe(6);
    expect(physician.byCompetencyId["skill:surgery"]?.effectiveCompetence).toBe(2);
    expect(physician.byCompetencyId["spec:diagnostic-medicine"]?.effectiveCompetence).toBe(3);

    const smith = calculateCharacter("character:pilot:lankhmar-weaponsmith-factor").result;
    expect(smith.byCompetencyId["skill:smithing"]?.acquiredBaseCompetence).toBe(11);
    expect(smith.byCompetencyId["spec:weaponsmithing"]?.specialization).toMatchObject({
      eligible: true,
      owned: true,
    });
    expect(smith.byCompetencyId["spec:weaponsmithing"]?.effectiveCompetence).toBe(5);

    const pilot = calculateCharacter("character:pilot:lankhmar-coastal-pilot").result;
    expect(pilot.byCompetencyId["skill:pilotage"]?.effectiveCompetence).toBe(6);
    expect(pilot.byCompetencyId["skill:wayfinding"]?.effectiveCompetence).toBe(6);
    expect(pilot.byCompetencyId["spec:home-coast-pilotage"]?.effectiveCompetence).toBe(4);
  });

  it("retains authored overlaps while strongest-only pricing stays deterministic", () => {
    const { input, result } = calculateCharacter("character:pilot:nkolian-caravan-scout");
    const wayfindingMemberships = result.groupBundle.memberships.filter(
      ({ competencyId }) => competencyId === "skill:wayfinding",
    );
    expect(wayfindingMemberships).toHaveLength(2);
    expect(wayfindingMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupId: "hist:nkolo-caravan-factor",
          groupLevel: 3,
          selectedAsStrongest: true,
          usefulIncrementalCompetence: 3,
        }),
        expect.objectContaining({
          groupId: "hist:nkolo-scout-journeys",
          groupLevel: 2,
          selectedAsStrongest: false,
          usefulIncrementalCompetence: 0,
        }),
      ]),
    );
    const reversed = calculatePilotSkillBuild({
      ...input,
      groups: [...(input.groups ?? [])].reverse().map((group) => ({
        ...group,
        competencyIds: [...group.competencyIds].reverse(),
      })),
      relationships: [...(input.relationships ?? [])].reverse(),
    });
    expect(reversed).toEqual(result);
  });

  it("keeps relationships directional and non-recursive", () => {
    const hybrid = calculateCharacter("character:pilot:nkolian-caravan-scout").result;
    expect(hybrid.byCompetencyId["skill:tracking"]?.acquiredBaseCompetence).toBe(2);
    expect(hybrid.byCompetencyId["skill:hunting"]?.effectiveCompetence).toBe(1);
    expect(hybrid.byCompetencyId["skill:pilotage"]?.effectiveCompetence).toBe(1);
    expect(hybrid.byCompetencyId["spec:home-coast-pilotage"]?.effectiveCompetence).toBe(0);
    expect(hybrid.v1RelationshipPolicy.recursion).toBe("non-recursive-temporary-pilot-limitation");
    const veteran = calculateCharacter("character:pilot:glantrian-retainer-veteran").result;
    expect(veteran.byCompetencyId["skill:sword"]?.relationshipCandidates).toEqual([]);
  });

  it("proves Profession identity is inert and access/exception routes grant zero XP", () => {
    const { input, result } = calculateCharacter("character:pilot:mogrebi-temple-physician");
    expect(calculatePilotSkillBuild({ ...input, professionId: "profession:changed" })).toEqual(
      result,
    );

    const profile = pilotSkillContentReleaseV1.profiles.find(({ id }) =>
      id.includes("mogreb-temple-state"),
    )!;
    const exception = pilotSkillContentReleaseV1.accessExceptions.find(({ id }) =>
      id.includes("surgeon-neseret"),
    )!;
    const kernelProfile = {
      accessBand: profile.accessBand,
      competencyOverrides: profile.overrides.flatMap((override) =>
        override.competencyIds.map((competencyId) => ({
          attributionId: override.attributionId,
          availability: override.availability,
          competencyId,
          explanation: override.explanation,
        })),
      ),
      developmentStage: profile.developmentStage,
      id: profile.id,
    };
    expect(
      resolvePilotSkillAccess({
        competencyId: "skill:surgery",
        domainId: "domain:healing",
        profile: kernelProfile,
      }),
    ).toMatchObject({ availability: "restricted", competenceGranted: 0 });
    expect(
      resolvePilotSkillAccess({
        competencyId: "skill:surgery",
        domainId: "domain:healing",
        exception: {
          attributionId: exception.id,
          basis: exception.basis,
          explanation: exception.explanation,
        },
        profile: kernelProfile,
      }),
    ).toMatchObject({
      availability: "available",
      competenceGranted: 0,
      resolvedBy: "accepted-exception",
    });
  });

  it("does not let writing or a directly purchased language satisfy the background-language invariant", () => {
    const { input } = calculateCharacter("character:pilot:olog-chancery-clerk");
    const withoutBackgroundGrant: PilotSkillBuildInput = {
      ...input,
      directAcquisitions: [
        ...(input.directAcquisitions ?? []),
        { competencyId: "spoken:common", ranks: 11 },
      ],
      grantedAcquisitions: [],
    };
    const result = calculatePilotSkillBuild(withoutBackgroundGrant);
    expect(
      validatePilotSkillFinalization({
        build: result,
        competencies: withoutBackgroundGrant.competencies,
      }),
    ).toEqual({
      errors: [expect.objectContaining({ code: "PILOT_SKILL_MISSING_SPOKEN_LANGUAGE" })],
      valid: false,
    });
    expect(result.byCompetencyId["written:ologian:church-ologian"]?.acquiredBaseCompetence).toBe(4);
  });
});

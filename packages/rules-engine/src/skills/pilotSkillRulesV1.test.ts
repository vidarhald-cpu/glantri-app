import type { PilotSkillEconomicWeight } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  calculatePilotDirectSkillCost,
  calculatePilotLearningGroupBundle,
  calculatePilotSkillBuild,
  calculatePilotSpecializationAcquisitionCost,
  evaluatePilotChargenBudget,
  getPilotSkillCompetenceBand,
  resolvePilotSkillAccess,
  validatePilotSkillFinalization,
  type PilotSkillCompetencyDefinition,
  type PilotSkillBuildInput,
  type PilotSkillLearningGroup,
  type PilotSkillRelationship,
} from "./pilotSkillRulesV1";

function skill(
  id: string,
  weight: PilotSkillEconomicWeight = 2,
  kind: PilotSkillCompetencyDefinition["kind"] = "skill",
): PilotSkillCompetencyDefinition {
  return { id, kind, name: id, weight };
}

function specialization(input: {
  baseId: string;
  id: string;
  justification?: string;
  threshold?: number;
}): PilotSkillCompetencyDefinition {
  return {
    id: input.id,
    kind: "specialization",
    name: input.id,
    specialization: {
      acquisitionWeight: 1,
      prerequisites: [
        {
          competencyId: input.baseId,
          justification: input.justification,
          threshold: input.threshold ?? 6,
        },
      ],
    },
  };
}

describe("Pilot Skill Rules v1 economics", () => {
  it("prices direct ranks by authored weight without imposing a competence maximum", () => {
    expect(calculatePilotDirectSkillCost(3, 4)).toBe(12);
    expect(calculatePilotDirectSkillCost(1, 4)).toBe(4);
    expect(calculatePilotDirectSkillCost(3, 30)).toBe(90);
  });

  it("charges specialization initiation once and makes the first rank explicit", () => {
    expect(calculatePilotSpecializationAcquisitionCost({ acquiredRanks: 1, weight: 1 })).toBe(3);
    expect(calculatePilotSpecializationAcquisitionCost({ acquiredRanks: 2, weight: 1 })).toBe(4);
    expect(
      calculatePilotSpecializationAcquisitionCost({
        acquiredRanks: 2,
        alreadyOwned: true,
        weight: 1,
      }),
    ).toBe(2);
  });

  it("uses the accepted competence bands", () => {
    expect([0, 1, 5, 6, 10, 11, 15, 16, 20, 21].map(getPilotSkillCompetenceBand)).toEqual([
      "untrained",
      "beginner",
      "beginner",
      "intermediate",
      "intermediate",
      "experienced",
      "experienced",
      "expert",
      "expert",
      "world-class",
    ]);
  });
});

describe("Pilot Skill Rules v1 learning groups", () => {
  const competencies = [skill("sword", 2), skill("shield", 2)];

  it("retains weaker duplicate memberships while charging zero for suppressed competence", () => {
    const result = calculatePilotLearningGroupBundle({
      competencies,
      groups: [
        { competencyIds: ["sword"], id: "city-watch", level: 4, name: "City Watch" },
        {
          competencyIds: ["sword", "shield"],
          id: "veteran-campaign",
          level: 2,
          name: "Veteran Campaign",
        },
      ],
    });

    expect(result.byCompetencyId.sword).toMatchObject({
      bestGroupContribution: 4,
      usefulIncrementalCompetence: 4,
    });
    expect(result.memberships.filter((row) => row.competencyId === "sword")).toEqual([
      expect.objectContaining({
        groupId: "city-watch",
        selectedAsStrongest: true,
        usefulIncrementalCompetence: 4,
      }),
      expect.objectContaining({
        groupId: "veteran-campaign",
        selectedAsStrongest: false,
        suppressedByGroupId: "city-watch",
        suppressedByGroupLevel: 4,
        usefulIncrementalCompetence: 0,
        weightedUsefulIncrement: 0,
      }),
    ]);
    expect(result.weightedUsefulIncrement).toBe(12);
    expect(result.bundleCost).toBe(8);
  });

  it("prices final strongest contribution rather than adding levels 2 and 4", () => {
    const groups: PilotSkillLearningGroup[] = [
      { competencyIds: ["sword"], id: "a", level: 2, name: "A" },
      { competencyIds: ["sword"], id: "b", level: 4, name: "B" },
    ];
    const firstOrder = calculatePilotLearningGroupBundle({ competencies, groups });
    const secondOrder = calculatePilotLearningGroupBundle({
      competencies,
      groups: [...groups].reverse(),
    });

    expect(firstOrder.byCompetencyId.sword.usefulIncrementalCompetence).toBe(4);
    expect(firstOrder.weightedUsefulIncrement).toBe(8);
    expect(firstOrder.bundleCost).toBe(6);
    expect(secondOrder).toEqual(firstOrder);
  });

  it("credits explicit relationship overlap before pricing the target group contribution", () => {
    const result = calculatePilotLearningGroupBundle({
      competencies: [skill("medicine", 3), skill("first-aid", 1)],
      groups: [
        {
          competencyIds: ["medicine", "first-aid"],
          id: "infirmary",
          level: 4,
          name: "Infirmary",
        },
      ],
      relationships: [
        {
          id: "medicine-includes-first-aid",
          sourceCompetencyId: "medicine",
          strength: 100,
          targetCompetencyId: "first-aid",
        },
      ],
    });

    expect(result.byCompetencyId["first-aid"]).toMatchObject({
      relationshipFloorBeforeOwnGroupContribution: 4,
      usefulIncrementalCompetence: 0,
      weightedUsefulIncrement: 0,
    });
    expect(result.weightedUsefulIncrement).toBe(12);
    expect(result.bundleCost).toBe(8);
  });

  it("adds direct ranks on top of the strongest group contribution", () => {
    const result = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [{ competencyId: "sword", ranks: 3 }],
      groups: [
        { competencyIds: ["sword"], id: "a", level: 4, name: "A" },
        { competencyIds: ["sword"], id: "b", level: 2, name: "B" },
      ],
    });

    expect(result.byCompetencyId.sword).toMatchObject({
      acquiredBaseCompetence: 7,
      directRanks: 3,
      groupContribution: 4,
    });
  });
});

describe("Pilot Skill Rules v1 relationships", () => {
  const competencies = [skill("a"), skill("b"), skill("c"), skill("target")];

  it("floors candidates before selecting the strongest and never stacks incoming results", () => {
    const result = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [
        { competencyId: "a", ranks: 5 },
        { competencyId: "b", ranks: 7 },
      ],
      relationships: [
        {
          id: "a-75",
          sourceCompetencyId: "a",
          strength: 75,
          targetCompetencyId: "target",
        },
        {
          id: "b-75",
          sourceCompetencyId: "b",
          strength: 75,
          targetCompetencyId: "target",
        },
      ],
    });

    expect(
      result.byCompetencyId.target.relationshipCandidates.map(
        (candidate) => candidate.candidateCompetence,
      ),
    ).toEqual([5, 3]);
    expect(result.byCompetencyId.target.effectiveCompetence).toBe(5);
  });

  it("implements all four explicit relationship strengths", () => {
    const result = calculatePilotSkillBuild({
      competencies: [
        skill("source"),
        skill("target-100"),
        skill("target-75"),
        skill("target-50"),
        skill("target-25"),
      ],
      directAcquisitions: [{ competencyId: "source", ranks: 8 }],
      relationships: [
        {
          id: "edge-100",
          sourceCompetencyId: "source",
          strength: 100,
          targetCompetencyId: "target-100",
        },
        {
          id: "edge-75",
          sourceCompetencyId: "source",
          strength: 75,
          targetCompetencyId: "target-75",
        },
        {
          id: "edge-50",
          sourceCompetencyId: "source",
          strength: 50,
          targetCompetencyId: "target-50",
        },
        {
          id: "edge-25",
          sourceCompetencyId: "source",
          strength: 25,
          targetCompetencyId: "target-25",
        },
      ],
    });

    expect(
      ["target-100", "target-75", "target-50", "target-25"].map(
        (id) => result.byCompetencyId[id].effectiveCompetence,
      ),
    ).toEqual([8, 6, 4, 2]);
  });

  it("breaks equal-result ties by relationship ID independent of input order", () => {
    const relationships: PilotSkillRelationship[] = [
      {
        id: "z-edge",
        sourceCompetencyId: "a",
        strength: 50,
        targetCompetencyId: "target",
      },
      {
        id: "a-edge",
        sourceCompetencyId: "b",
        strength: 50,
        targetCompetencyId: "target",
      },
    ];
    const calculate = (edges: PilotSkillRelationship[]) =>
      calculatePilotSkillBuild({
        competencies,
        directAcquisitions: [
          { competencyId: "a", ranks: 6 },
          { competencyId: "b", ranks: 6 },
        ],
        relationships: edges,
      });

    expect(
      calculate(relationships).byCompetencyId.target.selectedRelationship?.relationshipId,
    ).toBe("a-edge");
    expect(calculate([...relationships].reverse())).toEqual(calculate(relationships));
  });

  it("does not infer reverse edges", () => {
    const result = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [{ competencyId: "a", ranks: 8 }],
      relationships: [
        {
          id: "a-to-b",
          sourceCompetencyId: "a",
          strength: 50,
          targetCompetencyId: "b",
        },
      ],
    });

    expect(result.byCompetencyId.b.effectiveCompetence).toBe(4);
    expect(result.byCompetencyId.a.relationshipCandidates).toEqual([]);
  });

  it("is deliberately non-recursive and cycle resistant", () => {
    const result = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [{ competencyId: "a", ranks: 8 }],
      relationships: [
        {
          id: "a-to-b",
          sourceCompetencyId: "a",
          strength: 50,
          targetCompetencyId: "b",
        },
        {
          id: "b-to-c",
          sourceCompetencyId: "b",
          strength: 100,
          targetCompetencyId: "c",
        },
        {
          id: "c-to-a",
          sourceCompetencyId: "c",
          strength: 100,
          targetCompetencyId: "a",
        },
      ],
    });

    expect(result.byCompetencyId.b.effectiveCompetence).toBe(4);
    expect(result.byCompetencyId.c.relationshipFloor).toBe(0);
    expect(result.byCompetencyId.c.effectiveCompetence).toBe(0);
    expect(result.byCompetencyId.a.effectiveCompetence).toBe(8);
    expect(result.v1RelationshipPolicy.recursion).toBe("non-recursive-temporary-pilot-limitation");
  });
});

describe("Pilot Skill Rules v1 specializations", () => {
  it("uses acquired/group base for thresholds 6 and 11 and requires an explicit first rank", () => {
    const competencies = [
      skill("base-six"),
      skill("base-eleven"),
      specialization({ baseId: "base-six", id: "spec-six" }),
      specialization({ baseId: "base-eleven", id: "spec-eleven", threshold: 11 }),
    ];
    const below = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [
        { competencyId: "base-six", ranks: 5 },
        { competencyId: "base-eleven", ranks: 10 },
      ],
    });
    const atThreshold = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [
        { competencyId: "base-six", ranks: 6 },
        { competencyId: "base-eleven", ranks: 11 },
      ],
    });
    const acquired = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [
        { competencyId: "base-six", ranks: 6 },
        { competencyId: "spec-six", ranks: 1 },
      ],
    });

    expect(below.byCompetencyId["spec-six"].specialization).toMatchObject({
      eligible: false,
      owned: false,
    });
    expect(below.byCompetencyId["spec-eleven"].specialization?.eligible).toBe(false);
    expect(atThreshold.byCompetencyId["spec-six"].specialization).toMatchObject({
      eligible: true,
      owned: false,
    });
    expect(atThreshold.byCompetencyId["spec-eleven"].specialization).toMatchObject({
      eligible: true,
      owned: false,
    });
    expect(acquired.byCompetencyId["spec-six"].specialization).toMatchObject({
      acquiredRanks: 1,
      eligible: true,
      owned: true,
    });
  });

  it.each([
    { baseRanks: 5, threshold: 6 },
    { baseRanks: 10, threshold: 11 },
  ])(
    "rejects an attempted first rank below threshold $threshold without competence, ownership, or price",
    ({ baseRanks, threshold }) => {
      const result = calculatePilotSkillBuild({
        competencies: [skill("base"), specialization({ baseId: "base", id: "spec", threshold })],
        directAcquisitions: [
          { competencyId: "base", ranks: baseRanks },
          { competencyId: "spec", ranks: 1 },
        ],
      });

      expect(result.specializationCost).toBe(0);
      expect(result.byCompetencyId.spec).toMatchObject({
        acquiredBaseCompetence: 0,
        directRanks: 0,
        effectiveCompetence: 0,
        relationshipTargetBlockedUntilAcquired: true,
        specialization: {
          acquiredRanks: 0,
          eligible: false,
          owned: false,
        },
      });
    },
  );

  it.each([
    { baseRanks: 6, threshold: 6 },
    { baseRanks: 7, threshold: 6 },
    { baseRanks: 11, threshold: 11 },
    { baseRanks: 12, threshold: 11 },
  ])(
    "accepts an explicit first rank at/above threshold $threshold with base $baseRanks",
    ({ baseRanks, threshold }) => {
      const result = calculatePilotSkillBuild({
        competencies: [skill("base"), specialization({ baseId: "base", id: "spec", threshold })],
        directAcquisitions: [
          { competencyId: "base", ranks: baseRanks },
          { competencyId: "spec", ranks: 1 },
        ],
      });

      expect(result.specializationCost).toBe(3);
      expect(result.byCompetencyId.spec).toMatchObject({
        acquiredBaseCompetence: 1,
        directRanks: 1,
        effectiveCompetence: 1,
        relationshipTargetBlockedUntilAcquired: false,
        specialization: {
          acquiredRanks: 1,
          eligible: true,
          owned: true,
        },
      });
    },
  );

  it("allows zero-transfer specializations", () => {
    const result = calculatePilotSkillBuild({
      competencies: [skill("base"), specialization({ baseId: "base", id: "zero-edge" })],
      directAcquisitions: [
        { competencyId: "base", ranks: 6 },
        { competencyId: "zero-edge", ranks: 2 },
      ],
      relationships: [],
    });

    expect(result.byCompetencyId["zero-edge"]).toMatchObject({
      effectiveCompetence: 2,
      relationshipFloor: 0,
    });
  });

  it("can raise an acquired specialization through an explicit edge but cannot acquire it", () => {
    const competencies = [skill("base"), specialization({ baseId: "base", id: "spec" })];
    const relationship: PilotSkillRelationship = {
      id: "base-to-spec",
      sourceCompetencyId: "base",
      strength: 50,
      targetCompetencyId: "spec",
    };
    const unacquired = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [{ competencyId: "base", ranks: 6 }],
      relationships: [relationship],
    });
    const acquired = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [
        { competencyId: "base", ranks: 6 },
        { competencyId: "spec", ranks: 1 },
      ],
      relationships: [relationship],
    });

    expect(unacquired.byCompetencyId.spec).toMatchObject({
      effectiveCompetence: 0,
      relationshipFloor: 3,
      relationshipTargetBlockedUntilAcquired: true,
      specialization: { eligible: true, owned: false },
    });
    expect(acquired.byCompetencyId.spec).toMatchObject({
      effectiveCompetence: 3,
      relationshipGoverns: true,
      specialization: { eligible: true, owned: true },
    });
  });

  it("does not let relationship-derived competence satisfy another prerequisite", () => {
    const competencies = [
      skill("source"),
      skill("base"),
      specialization({ baseId: "base", id: "spec" }),
    ];
    const result = calculatePilotSkillBuild({
      competencies,
      directAcquisitions: [{ competencyId: "source", ranks: 12 }],
      relationships: [
        {
          id: "source-to-base",
          sourceCompetencyId: "source",
          strength: 50,
          targetCompetencyId: "base",
        },
      ],
    });

    expect(result.byCompetencyId.base.effectiveCompetence).toBe(6);
    expect(result.byCompetencyId.spec.specialization).toMatchObject({
      eligible: false,
      prerequisites: [{ acquiredBaseCompetence: 0, met: false, threshold: 6 }],
    });
  });

  it("requires authored justification for a nonstandard prerequisite threshold", () => {
    expect(() =>
      calculatePilotSkillBuild({
        competencies: [skill("base"), specialization({ baseId: "base", id: "spec", threshold: 8 })],
      }),
    ).toThrow("PILOT_SKILL_NONSTANDARD_SPECIALIZATION_THRESHOLD_NEEDS_JUSTIFICATION");
    expect(() =>
      calculatePilotSkillBuild({
        competencies: [
          skill("base"),
          specialization({
            baseId: "base",
            id: "spec",
            justification: "This technique needs extended supervised practice.",
            threshold: 8,
          }),
        ],
      }),
    ).not.toThrow();
  });
});

describe("Pilot Skill Rules v1 access, budgets, identity, and language", () => {
  it("uses competency then domain then profile precedence and grants no competence", () => {
    const profile = {
      accessBand: "AB3" as const,
      competencyOverrides: [
        {
          attributionId: "surgery-rule",
          availability: "restricted" as const,
          competencyId: "surgery",
          explanation: "Surgery needs an institutional route.",
        },
      ],
      defaultAvailability: "available" as const,
      developmentStage: "DS4" as const,
      domainOverrides: [
        {
          attributionId: "healing-domain",
          availability: "unavailable" as const,
          domainId: "healing",
          explanation: "Advanced healing is not normally present.",
        },
      ],
      id: "profile",
    };
    const restricted = resolvePilotSkillAccess({
      competencyId: "surgery",
      domainId: "healing",
      profile,
    });
    const exception = resolvePilotSkillAccess({
      competencyId: "surgery",
      domainId: "healing",
      exception: {
        attributionId: "teacher-ada",
        basis: "teacher",
        explanation: "Teacher Ada accepts the Character.",
      },
      profile,
    });
    const domain = resolvePilotSkillAccess({
      competencyId: "medicine",
      domainId: "healing",
      profile,
    });
    const profileDefault = resolvePilotSkillAccess({
      competencyId: "trade",
      domainId: "commerce",
      profile,
    });

    expect(restricted).toMatchObject({
      availability: "restricted",
      competenceGranted: 0,
      resolvedBy: "competency-override",
    });
    expect(exception).toMatchObject({
      availability: "available",
      competenceGranted: 0,
      resolvedBy: "accepted-exception",
    });
    expect(domain).toMatchObject({
      availability: "unavailable",
      competenceGranted: 0,
      resolvedBy: "domain-override",
    });
    expect(profileDefault).toMatchObject({
      availability: "available",
      competenceGranted: 0,
      resolvedBy: "profile-default",
    });
  });

  it("consumes supplied Formation/Flex budgets and never treats 60 as a kernel constant", () => {
    const standard = evaluatePilotChargenBudget({
      configuration: { flexBudget: 26, formationBudget: 60 },
      purchases: [{ access: "available", cost: 62, formationEligible: true, id: "build" }],
    });
    const configured = evaluatePilotChargenBudget({
      configuration: { flexBudget: 5, formationBudget: 47 },
      purchases: [{ access: "available", cost: 49, formationEligible: true, id: "build" }],
    });

    expect(standard).toMatchObject({ formationSpent: 60, flexSpent: 2, valid: true });
    expect(configured).toMatchObject({ formationSpent: 47, flexSpent: 2, valid: true });
  });

  it("evaluates access before spend even when budget is available", () => {
    const result = evaluatePilotChargenBudget({
      configuration: { flexBudget: 100, formationBudget: 100 },
      purchases: [{ access: "unavailable", cost: 1, formationEligible: true, id: "forbidden" }],
    });

    expect(result).toMatchObject({
      errors: [{ code: "PILOT_SKILL_ACCESS_NOT_AVAILABLE", purchaseId: "forbidden" }],
      flexSpent: 0,
      formationSpent: 0,
      valid: false,
    });
  });

  it("keeps Profession mechanically inert", () => {
    const common = {
      competencies: [skill("trade")],
      directAcquisitions: [{ competencyId: "trade", ranks: 4 }],
    };

    expect(calculatePilotSkillBuild({ ...common, professionId: "merchant" })).toEqual(
      calculatePilotSkillBuild({ ...common, professionId: "court-official" }),
    );
  });

  const languageCompetencies = [
    skill("spoken-thyatian", 2, "spoken-language"),
    skill("written-thyatian", 2, "written-tradition"),
  ];

  it.each(["society", "background"] as const)(
    "accepts a starting spoken language granted by %s without granting writing",
    (sourceKind) => {
      const build = calculatePilotSkillBuild({
        competencies: languageCompetencies,
        grantedAcquisitions: [
          {
            competencyId: "spoken-thyatian",
            ranks: 11,
            sourceId: `${sourceKind}:thyatis`,
            sourceKind,
          },
        ],
      });

      expect(validatePilotSkillFinalization({ build, competencies: languageCompetencies })).toEqual(
        {
          errors: [],
          valid: true,
        },
      );
      expect(build.byCompetencyId["spoken-thyatian"].grantSources).toEqual([
        expect.objectContaining({ sourceKind }),
      ]);
      expect(build.byCompetencyId["written-thyatian"].acquiredBaseCompetence).toBe(0);
    },
  );

  it.each([
    {
      input: { directAcquisitions: [{ competencyId: "spoken-thyatian", ranks: 11 }] },
      name: "direct-only spoken language",
    },
    {
      input: {
        groups: [
          {
            competencyIds: ["spoken-thyatian"],
            id: "history:language-school",
            level: 11,
            name: "Language school",
          },
        ],
      },
      name: "group-only spoken language",
    },
    {
      input: {
        grantedAcquisitions: [
          {
            competencyId: "written-thyatian",
            ranks: 11,
            sourceId: "background:clerk",
            sourceKind: "background",
          },
        ],
      },
      name: "written-only background grant",
    },
    {
      input: {
        grantedAcquisitions: [
          {
            competencyId: "spoken-thyatian",
            ranks: 11,
            sourceId: "grant:manual",
            sourceKind: "other-explicit-grant",
          },
        ],
      },
      name: "non-starting explicit spoken-language grant",
    },
    { input: {}, name: "missing language" },
  ] satisfies Array<{
    input: Omit<PilotSkillBuildInput, "competencies">;
    name: string;
  }>)("rejects $name for the starting-language invariant", ({ input }) => {
    const build = calculatePilotSkillBuild({ competencies: languageCompetencies, ...input });

    expect(validatePilotSkillFinalization({ build, competencies: languageCompetencies })).toEqual({
      errors: [
        {
          code: "PILOT_SKILL_MISSING_SPOKEN_LANGUAGE",
          message:
            "A finalized Character must have a starting spoken language granted by society or background.",
        },
      ],
      valid: false,
    });
  });

  it("never treats written tradition as spoken or grants it from spoken language", () => {
    const competencies = [
      skill("spoken-thyatian", 2, "spoken-language"),
      skill("written-thyatian", 2, "written-tradition"),
    ];
    const writtenOnly = calculatePilotSkillBuild({
      competencies,
      grantedAcquisitions: [
        {
          competencyId: "written-thyatian",
          ranks: 11,
          sourceId: "background:clerk",
          sourceKind: "background",
        },
      ],
    });
    expect(validatePilotSkillFinalization({ build: writtenOnly, competencies })).toMatchObject({
      errors: [{ code: "PILOT_SKILL_MISSING_SPOKEN_LANGUAGE" }],
      valid: false,
    });
  });
});

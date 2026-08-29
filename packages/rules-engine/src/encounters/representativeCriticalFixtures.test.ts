import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  accrueRepresentativeBleed,
  buildRepresentativeCriticalRuntimeDefinition,
  getActiveMortalityOrPermanenceMechanics,
  getRepresentativeCriticalFixture,
  getRepresentativeTreatmentSkillCandidates,
  isCriticalConsequenceActiveForPendingInitiative,
  REPRESENTATIVE_CRITICAL_FIXTURES,
  resolveRepresentativeBleedRate,
  sumIndependentCriticalStuns,
  verifyRepresentativeCriticalFixtureSources,
} from "./representativeCriticalFixtures";

describe("#377 representative C1 Critical fixtures", () => {
  it("freezes the exact 34-key representative content set as a deterministic golden", () => {
    expect(REPRESENTATIVE_CRITICAL_FIXTURES).toHaveLength(34);
    expect(
      createHash("sha256").update(JSON.stringify(REPRESENTATIVE_CRITICAL_FIXTURES)).digest("hex"),
    ).toBe("373b8e6e02efb6676667acf15000c0000a53469473677819d01c21595ca5a10d");
  });

  it("retains unique stable identities, exact workbook provenance, and current source rows", () => {
    const keys = REPRESENTATIVE_CRITICAL_FIXTURES.map((fixture) => fixture.criticalKey);

    expect(new Set(keys).size).toBe(keys.length);
    expect(verifyRepresentativeCriticalFixtureSources()).toEqual([]);
    expect(
      REPRESENTATIVE_CRITICAL_FIXTURES.every(
        (fixture) =>
          fixture.provenance.resultRange.startsWith("AppFacing_Crits!A") &&
          fixture.provenance.effectRange.startsWith("AppFacing_Effects!A") &&
          fixture.provenance.workbookSha256 ===
            "47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f",
      ),
    ).toBe(true);
  });

  it("allows at most one Stun per Critical and applies its value to exactly three channels", () => {
    for (const fixture of REPRESENTATIVE_CRITICAL_FIXTURES) {
      expect(fixture.stun ? [fixture.stun] : []).toHaveLength(fixture.stun ? 1 : 0);
      if (fixture.stun?.modifier !== null && fixture.stun !== undefined) {
        expect(fixture.stun.channels).toEqual(["ob_skill", "db_parry", "initiative"]);
      }
    }

    expect(getRepresentativeCriticalFixture("pointed_weapons|arm|02")?.stun).toMatchObject({
      modifier: -1,
      severity: 1,
    });
    expect(getRepresentativeCriticalFixture("pointed_weapons|arm|09")?.stun).toMatchObject({
      modifier: -2,
      severity: 2,
    });
    expect(getRepresentativeCriticalFixture("pointed_weapons|arm|10")?.stun).toMatchObject({
      modifier: -4,
      severity: 3,
    });
    expect(getRepresentativeCriticalFixture("blunt|arm|12")?.stun).toMatchObject({
      modifier: -8,
      severity: 4,
    });
    expect(getRepresentativeCriticalFixture("sharp|head|04")?.stun).toMatchObject({
      modifier: null,
      severity: 5,
    });
  });

  it("covers every required action state, Bleed kind/rate family, and lookup-support boundary", () => {
    const conditions = new Set(
      REPRESENTATIVE_CRITICAL_FIXTURES.flatMap((fixture) =>
        fixture.conditions.map((candidate) => candidate.code),
      ),
    );
    expect(conditions).toEqual(
      new Set([
        "collapse",
        "function_unusable",
        "impaired",
        "no_action",
        "parry_only",
        "prone",
        "recovery_restricted",
        "restricted",
        "unconscious",
      ]),
    );

    const fixedRates = new Set(
      REPRESENTATIVE_CRITICAL_FIXTURES.flatMap((fixture) =>
        fixture.bleed.flatMap((bleed) =>
          bleed.rate.kind === "fixed"
            ? [`${bleed.rate.value.numerator}/${bleed.rate.value.denominator}`]
            : [],
        ),
      ),
    );
    expect(fixedRates).toEqual(new Set(["1/8", "1/3", "1/2", "2/3", "3/4"]));
    expect(
      new Set(
        REPRESENTATIVE_CRITICAL_FIXTURES.flatMap((fixture) =>
          fixture.bleed.map((bleed) => bleed.kind),
        ),
      ),
    ).toEqual(new Set(["external", "internal"]));
    expect(
      REPRESENTATIVE_CRITICAL_FIXTURES.filter(
        (fixture) => fixture.lookupSupport === "specialized_not_addressable",
      ).map((fixture) => fixture.family),
    ).toEqual([
      "arrows_bolts",
      "firearms",
      "falling_crushing",
      "falling_crushing",
      "fire_energy",
      "fire_energy",
      "fire_energy",
    ]);
  });

  it("keeps equal initiative simultaneous and affects only strictly later initiative", () => {
    expect(
      isCriticalConsequenceActiveForPendingInitiative({
        onset: "immediate",
        pendingInitiative: 7,
        sourceInitiative: 7,
      }),
    ).toBe(false);
    expect(
      isCriticalConsequenceActiveForPendingInitiative({
        onset: "immediate",
        pendingInitiative: 4,
        sourceInitiative: 7,
      }),
    ).toBe(true);
    expect(
      isCriticalConsequenceActiveForPendingInitiative({
        onset: "next_round",
        pendingInitiative: 4,
        sourceInitiative: 7,
      }),
    ).toBe(false);
    expect(
      isCriticalConsequenceActiveForPendingInitiative({
        onset: "immediate",
        pendingInitiative: 5,
        sourceInitiative: 4,
      }),
    ).toBe(false);
    const groupPermutations = [
      [7, 7, 4],
      [7, 4, 7],
      [4, 7, 7],
    ];
    for (const initiatives of groupPermutations) {
      expect(
        initiatives
          .map((pendingInitiative) => ({
            active: isCriticalConsequenceActiveForPendingInitiative({
              onset: "immediate",
              pendingInitiative,
              sourceInitiative: 7,
            }),
            pendingInitiative,
          }))
          .sort((left, right) => right.pendingInitiative - left.pendingInitiative),
      ).toEqual([
        { active: false, pendingInitiative: 7 },
        { active: false, pendingInitiative: 7 },
        { active: true, pendingInitiative: 4 },
      ]);
    }

    expect(getRepresentativeCriticalFixture("blunt|arm|12")?.initiativeExample).toEqual({
      equalAffected: false,
      equalInitiative: 7,
      laterAffected: true,
      laterInitiative: 4,
      sourceInitiative: 7,
    });
    expect(getRepresentativeCriticalFixture("sharp|head|04")?.initiativeExample).toEqual({
      equalAffected: false,
      equalInitiative: 7,
      laterAffected: false,
      laterInitiative: 4,
      sourceInitiative: 7,
    });
  });

  it("adds independent Critical-source Stuns without strongest-source suppression or a cap", () => {
    const mild = getRepresentativeCriticalFixture("pointed_weapons|arm|02")!.stun!;
    const severe = getRepresentativeCriticalFixture("blunt|arm|12")!.stun!;

    expect(sumIndependentCriticalStuns([mild, severe], "ob_skill")).toBe(-9);
    expect(sumIndependentCriticalStuns([mild, severe], "db_parry")).toBe(-9);
    expect(sumIndependentCriticalStuns([mild, severe], "initiative")).toBe(-9);
  });

  it("adds separate external/internal Bleeds with exact rational arithmetic and carried remainder", () => {
    const oneThird = getRepresentativeCriticalFixture("pointed_weapons|arm|09")!.bleed[0]!;
    const oneHalf = getRepresentativeCriticalFixture("sharp|chest|09")!.bleed[0]!;

    const first = accrueRepresentativeBleed({
      activeSources: [{ bleed: oneThird }, { bleed: oneHalf }],
    });
    expect(first).toEqual({
      appliedHp: 0,
      remainder: { denominator: 6, numerator: 5 },
      total: { denominator: 6, numerator: 5 },
    });

    const second = accrueRepresentativeBleed({
      activeSources: [{ bleed: oneThird }, { bleed: oneHalf }],
      previousRemainder: first.remainder,
    });
    expect(second).toEqual({
      appliedHp: 1,
      remainder: { denominator: 3, numerator: 2 },
      total: { denominator: 3, numerator: 5 },
    });
  });

  it("rolls each retained whole-body Bleed rate once and stores an exact rational rate", () => {
    const crush = getRepresentativeCriticalFixture("falling_crushing|whole_body|10")!;

    expect(resolveRepresentativeBleedRate(crush.bleed[0]!, 3)).toEqual({
      denominator: 12,
      numerator: 3,
    });
    expect(resolveRepresentativeBleedRate(crush.bleed[1]!, 4)).toEqual({
      denominator: 12,
      numerator: 4,
    });
    expect(() => resolveRepresentativeBleedRate(crush.bleed[0]!)).toThrow(
      "requires one stored positive roll",
    );
  });

  it("builds a retained server-owned runtime only for the 34 active fixtures", () => {
    const rolls = [0.49, 0.99];
    const runtime = buildRepresentativeCriticalRuntimeDefinition(
      "falling_crushing|whole_body|10",
      () => rolls.shift() ?? 0,
    );

    expect(runtime?.bleed).toEqual([
      expect.objectContaining({
        allowedControlStates: ["active", "partial", "staunched_zero", "resolved"],
        rate: { denominator: 12, numerator: 2 },
        rollFormula: "d4",
        storedRoll: 2,
      }),
      expect.objectContaining({
        allowedControlStates: ["active", "stabilised", "resolved"],
        rate: { denominator: 12, numerator: 4 },
        rollFormula: "d4",
        storedRoll: 4,
      }),
    ]);
    expect(buildRepresentativeCriticalRuntimeDefinition("sharp|arm|02")).toBeUndefined();
  });

  it("maps blunt|arm|12 into separate severe Stun, collapse, hand loss, drop, Bleed, and care facts", () => {
    const runtime = buildRepresentativeCriticalRuntimeDefinition("blunt|arm|12", () => 0);

    expect(runtime).toMatchObject({
      bleed: [
        expect.objectContaining({
          firstTickRound: 1,
          kind: "external",
          rate: { denominator: 2, numerator: 1 },
        }),
      ],
      conditions: expect.arrayContaining([
        expect.objectContaining({ code: "collapse", target: "whole_body" }),
        expect.objectContaining({ code: "function_unusable", target: "hand" }),
      ]),
      criticalKey: "blunt|arm|12",
      operations: ["drop_held_item"],
      stun: expect.objectContaining({
        channels: ["ob_skill", "db_parry", "initiative"],
        modifier: -8,
      }),
      treatment: expect.objectContaining({
        stages: [
          { role: "field_control", skill: "first_aid" },
          { role: "definitive_care", skill: "surgery" },
        ],
      }),
    });
  });

  it("does not manufacture a Skill candidate from generic treatment language", () => {
    const generic = getRepresentativeCriticalFixture("pointed_weapons|arm|09")!;
    const medicine = getRepresentativeCriticalFixture("fire_energy|whole_body|09")!;
    const staged = getRepresentativeCriticalFixture("blunt|arm|12")!;

    expect(generic.treatment.sourceGate).toBe("until treated");
    expect(generic.treatment.gmManaged).toBe(true);
    expect(getRepresentativeTreatmentSkillCandidates(generic)).toEqual([]);
    expect(getRepresentativeTreatmentSkillCandidates(medicine)).toEqual(["medicine"]);
    expect(getRepresentativeTreatmentSkillCandidates(staged)).toEqual(["first_aid", "surgery"]);
  });

  it("keeps mortality, permanence, and recovery prose information-only", () => {
    const mortal = getRepresentativeCriticalFixture("falling_crushing|whole_body|12")!;
    const permanent = getRepresentativeCriticalFixture("sharp|arm|12")!;

    expect(mortal.information.some((fact) => fact.topic === "mortality")).toBe(true);
    expect(permanent.information.some((fact) => fact.topic === "permanence")).toBe(true);
    expect(mortal.information.every((fact) => fact.mechanicallyActive === false)).toBe(true);
    expect(permanent.information.every((fact) => fact.mechanicallyActive === false)).toBe(true);
    expect(getActiveMortalityOrPermanenceMechanics(mortal)).toEqual([]);
    expect(getActiveMortalityOrPermanenceMechanics(permanent)).toEqual([]);
  });

  it("keeps drop, fall/prone, embedded-object guidance, and function loss separate", () => {
    const drop = getRepresentativeCriticalFixture("pointed_weapons|arm|02")!;
    const fall = getRepresentativeCriticalFixture("sharp|chest|05")!;
    const embedded = getRepresentativeCriticalFixture("pointed_weapons|abdomen|08")!;
    const targetOnly = getRepresentativeCriticalFixture("pointed_weapons|arm|09")!;

    expect(drop.operations).toEqual(["drop_held_item"]);
    expect(drop.conditions).toContainEqual(
      expect.objectContaining({ code: "impaired", target: "hand" }),
    );
    expect(fall.operations).toEqual(["fall_to_ground"]);
    expect(fall.conditions).toContainEqual(
      expect.objectContaining({ code: "prone", target: "stance" }),
    );
    expect(embedded.operations).toEqual([]);
    expect(embedded.information).toContainEqual(
      expect.objectContaining({ value: expect.stringContaining("removal risk") }),
    );
    expect(targetOnly.conditions).toContainEqual(
      expect.objectContaining({ code: "function_unusable", target: "arm" }),
    );
    expect(targetOnly.conditions.some((candidate) => candidate.code === "collapse")).toBe(false);
  });
});

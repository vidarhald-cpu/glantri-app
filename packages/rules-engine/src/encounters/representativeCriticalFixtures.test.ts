import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  combatCriticalEndEventSchema,
  getCombatCriticalEndEventConditionKind,
} from "@glantri/domain";

import {
  accrueRepresentativeBleed,
  buildRepresentativeCriticalRuntimeDefinition,
  getC1FiveKeyCanonicalReview,
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
    ).toBe("d3e7d0d7f74a0d7f6c1d094d3373307fa04f573c4ad32efbbd927a117c3cdc53");
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
      modifier: -4,
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
    expect(fixedRates).toEqual(new Set(["1/8", "1/4", "1/3", "1/2", "2/3", "3/4"]));
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

    expect(sumIndependentCriticalStuns([mild, severe], "ob_skill")).toBe(-5);
    expect(sumIndependentCriticalStuns([mild, severe], "db_parry")).toBe(-5);
    expect(sumIndependentCriticalStuns([mild, severe], "initiative")).toBe(-5);
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

  it("keeps #387 runtime authority while limiting the new review contract to five keys", () => {
    expect(
      buildRepresentativeCriticalRuntimeDefinition("falling_crushing|whole_body|10"),
    ).toBeDefined();
    expect(buildRepresentativeCriticalRuntimeDefinition("sharp|arm|02")).toBeUndefined();
    expect(buildRepresentativeCriticalRuntimeDefinition("pointed_weapons|arm|02")).toBeDefined();
    expect(buildRepresentativeCriticalRuntimeDefinition("sharp|head|10")).toBeDefined();
    expect(getC1FiveKeyCanonicalReview("falling_crushing|whole_body|10")).toBeUndefined();
  });

  it("maps post-#393 blunt|arm|12 without the rejected collapse and with Stun -4", () => {
    const runtime = buildRepresentativeCriticalRuntimeDefinition("blunt|arm|12", () => 0);

    expect(runtime).toMatchObject({
      bleed: [
        expect.objectContaining({
          firstTickRound: 1,
          kind: "external",
          rate: { denominator: 2, numerator: 1 },
        }),
      ],
      conditions: [expect.objectContaining({ code: "function_unusable", target: "hand" })],
      criticalKey: "blunt|arm|12",
      operations: ["drop_held_item"],
      stun: expect.objectContaining({
        channels: ["ob_skill", "db_parry", "initiative"],
        modifier: -4,
      }),
      treatment: expect.objectContaining({
        stages: [
          { role: "field_control", skill: "first_aid" },
          { role: "definitive_care", skill: "surgery" },
        ],
      }),
    });
  });

  it("applies only permitted atom suppression and Stun magnitude deltas", () => {
    const runtime = buildRepresentativeCriticalRuntimeDefinition(
      "pointed_weapons|arm|02",
      () => 0,
      {
        criticalKey: "pointed_weapons|arm|02",
        stunModifierOverride: -4,
        suppressedEffectKeys: ["pointed_weapons|arm|02|03", "pointed_weapons|arm|02|05"],
      },
    );

    expect(runtime).toMatchObject({ bleed: [], operations: [], stun: { modifier: -4 } });
    expect(() =>
      buildRepresentativeCriticalRuntimeDefinition("pointed_weapons|arm|02", () => 0, {
        criticalKey: "pointed_weapons|arm|02",
        suppressedEffectKeys: ["pointed_weapons|arm|02|01"],
      }),
    ).toThrow("cannot be suppressed");
    expect(() =>
      buildRepresentativeCriticalRuntimeDefinition("sharp|head|10", () => 0, {
        criticalKey: "sharp|head|10",
        stunModifierOverride: -1,
        suppressedEffectKeys: [],
      }),
    ).toThrow("no Stun atom");
    expect(
      buildRepresentativeCriticalRuntimeDefinition("sharp|head|10", () => 0)?.conditions[0],
    ).toMatchObject({
      duration: { storedRoll: 1, unit: "hour" },
    });
  });

  it("publishes immutable six-kind review atoms with exact frozen provenance", () => {
    const review = getC1FiveKeyCanonicalReview("pointed_weapons|chest|07");
    expect(review).toMatchObject({
      criticalKey: "pointed_weapons|chest|07",
      provenance: {
        effectRange: "AppFacing_Effects!A1901:AE1904",
        resultRange: "AppFacing_Crits!A552:X552",
      },
      title: "Punctured lung shortens every breath",
    });
    expect(review?.atoms).toContainEqual(
      expect.objectContaining({
        kind: "periodic_loss",
        sourceEffectKey: "pointed_weapons|chest|07|03",
        summary: "Internal Bleed 1/4 HP per round",
      }),
    );
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

describe("[#215 S6] structured termination-event bindings on the representative fixtures", () => {
  // Measured at the frozen Wave 2 baseline: 33 production `until_event` durations carrying 7
  // distinct authored phrases. #215 §2.5 named two test lines, understating this by roughly 17x.
  const EXPECTED_PHRASE_COUNTS = {
    "until appropriate care": 11,
    "until staunched": 6,
    "until separately resolved": 6,
    "until controlled removal and care": 4,
    "until the mapped staunch event": 3,
    "until flames extinguished": 2,
    "while rolling to extinguish flames": 1,
  } as const;

  const PRE_S6_GOLDEN = "c25f320da6f7f02bacad8ebfd63e46455f2729fee9ed96391ddc3d2fd1e00020";

  function untilEventDurations(): readonly { endEvent?: string; text: string }[] {
    return REPRESENTATIVE_CRITICAL_FIXTURES.flatMap((fixture) =>
      [...fixture.conditions.map((condition) => condition.duration), fixture.stun?.duration].filter(
        (duration): duration is NonNullable<typeof duration> =>
          duration !== undefined && duration.kind === "until_event",
      ),
    );
  }

  it("has migrated every free-text residue site to a structured binding", () => {
    const durations = untilEventDurations();

    expect(durations).toHaveLength(33);
    expect(durations.every((duration) => duration.endEvent !== undefined)).toBe(true);
    for (const duration of durations) {
      expect(combatCriticalEndEventSchema.safeParse(duration.endEvent).success).toBe(true);
    }
  });

  it("preserves every authored phrase and its measured residue count exactly", () => {
    const counts = new Map<string, number>();
    for (const duration of untilEventDurations()) {
      counts.set(duration.text, (counts.get(duration.text) ?? 0) + 1);
    }

    expect(Object.fromEntries([...counts].sort())).toEqual(
      Object.fromEntries(Object.entries(EXPECTED_PHRASE_COUNTS).sort()),
    );
    expect([...counts.values()].reduce((total, count) => total + count, 0)).toBe(33);
  });

  it("changed the content set by exactly the additive binding and nothing else", () => {
    // Stripping `endEvent` back out reproduces the pre-S6 golden byte for byte. That is the
    // evidence that the migration added a structured field and altered no authored content.
    const stripped = JSON.stringify(REPRESENTATIVE_CRITICAL_FIXTURES, (key, value) =>
      key === "endEvent" ? undefined : value,
    );

    expect(createHash("sha256").update(stripped).digest("hex")).toBe(PRE_S6_GOLDEN);
  });

  it("resolves each bound event through the one canonical mapping", () => {
    const resolved = new Map<string, string | null>();
    for (const duration of untilEventDurations()) {
      const endEvent = combatCriticalEndEventSchema.parse(duration.endEvent);
      resolved.set(endEvent, getCombatCriticalEndEventConditionKind(endEvent));
    }

    expect(Object.fromEntries([...resolved].sort())).toEqual({
      appropriate_care: "treated",
      controlled_removal_and_care: "treated",
      extinguishing_flames: "source_process_completed",
      flames_extinguished: "source_process_completed",
      mapped_staunch_event: "treated",
      separately_resolved: null,
      staunched: "treated",
    });
  });
});

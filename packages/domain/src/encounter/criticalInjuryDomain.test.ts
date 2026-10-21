import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { combatCriticalEndEventSchema } from "./combatCriticalRuntime";
import {
  canonicalCombatModifierConditionKindSchema,
  canonicalCombatModifierDurationUnitSchema,
  canonicalCombatModifierRolledQuantitySchema,
  getCanonicalCombatModifierRolledDurationUnit,
  type CanonicalCombatModifierConditionKind,
} from "./combatModifierLifecycle";
import {
  appendCriticalInjuryTransition,
  createCriticalInjuryCase,
  getCriticalInjuryChildState,
  projectCriticalInjuryInformation,
} from "./criticalInjuryDomain";
import {
  criticalInjuryFixtureA,
  criticalInjuryFixtureB,
  criticalInjuryFixtureC,
  criticalInjuryFixtureD,
  criticalInjuryFixtureE,
  criticalInjuryFixtureF,
  REPRESENTATIVE_CRITICAL_INJURY_FIXTURES,
} from "./criticalInjuryFixtures";

describe("inert Critical injury domain contract", () => {
  it("stores six immutable accepted Critical outcomes with exact source provenance", () => {
    expect(
      REPRESENTATIVE_CRITICAL_INJURY_FIXTURES.map(
        (fixture) => fixture.outcome.originalSource.criticalResult.critKey,
      ),
    ).toEqual([
      "sharp|head|01",
      "sharp|upper_leg|08",
      "pointed_weapons|chest|05",
      "blunt|head|10",
      "sharp|arm|11",
      "sharp|head|12",
    ]);

    for (const fixture of REPRESENTATIVE_CRITICAL_INJURY_FIXTURES) {
      expect(fixture.outcome.originalSource.workbook).toBe(
        "docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx",
      );
      expect(fixture.outcome.originalSource.workbookSha256).toBe(
        "47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f",
      );
      expect(Object.isFrozen(fixture.outcome)).toBe(true);
      expect(Object.isFrozen(fixture.outcome.originalSource.criticalResult)).toBe(true);
      expect(fixture.outcome.originalSource.criticalResult.title.length).toBeGreaterThan(0);
      expect(fixture.outcome.originalSource.criticalResult.bodyText.length).toBeGreaterThan(0);
      expect(fixture.outcome.originalSource.effectTemplates.length).toBeGreaterThan(0);
    }
  });

  it("gives every consequence independent identity and direct outcome lineage", () => {
    for (const fixture of REPRESENTATIVE_CRITICAL_INJURY_FIXTURES) {
      const children = [
        ...fixture.operationalEffects,
        ...fixture.injuries,
        ...fixture.physiologyProcesses,
        ...fixture.functionStates,
        ...fixture.careEpisodes,
        ...fixture.informationFacts,
      ];

      expect(new Set(children.map((child) => child.id)).size).toBe(children.length);
      expect(children.every((child) => child.criticalOutcomeId === fixture.outcome.id)).toBe(true);
      expect(fixture.outcome.childManifest).toEqual(children.map(({ id, kind }) => ({ id, kind })));
    }

    expect(criticalInjuryFixtureB.outcome.childManifest.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining([
        "operational_effect",
        "injury",
        "physiology_process",
        "function_state",
        "care_episode",
        "information_fact",
      ]),
    );
  });

  it("appends and supersedes child transitions without mutating accepted outcome facts", () => {
    const outcomeBefore = JSON.stringify(criticalInjuryFixtureB.outcome);
    const first = appendCriticalInjuryTransition(criticalInjuryFixtureB, {
      fromState: "not_started",
      id: "critical-b:transition:care-started",
      recordedAt: "2026-08-13T12:01:00.000Z",
      reason: "Care began",
      targetId: "critical-b:care:bleeding",
      targetKind: "care_episode",
      toState: "in_progress",
    });
    const superseding = appendCriticalInjuryTransition(first, {
      fromState: "in_progress",
      id: "critical-b:transition:care-corrected",
      recordedAt: "2026-08-13T12:02:00.000Z",
      reason: "Later evidence corrected the care state without rewriting history",
      supersedesTransitionId: "critical-b:transition:care-started",
      targetId: "critical-b:care:bleeding",
      targetKind: "care_episode",
      toState: "not_started",
    });

    expect(criticalInjuryFixtureB.transitions).toEqual([]);
    expect(first.outcome).toBe(criticalInjuryFixtureB.outcome);
    expect(superseding.outcome).toBe(criticalInjuryFixtureB.outcome);
    expect(JSON.stringify(superseding.outcome)).toBe(outcomeBefore);
    expect(superseding.transitions.map((transition) => transition.id)).toEqual([
      "critical-b:transition:care-started",
      "critical-b:transition:care-corrected",
    ]);
    expect(getCriticalInjuryChildState(superseding, "critical-b:care:bleeding")).toBe(
      "not_started",
    );
  });

  it("expires mild and short shock effects without inventing structural recovery", () => {
    const afterA = appendCriticalInjuryTransition(criticalInjuryFixtureA, {
      fromState: "active",
      id: "critical-a:transition:stance-expired",
      recordedAt: "2026-08-13T12:00:03.000Z",
      reason: "Authored one-round duration elapsed",
      targetId: "critical-a:effect:stance",
      targetKind: "operational_effect",
      toState: "expired",
    });
    const afterE = appendCriticalInjuryTransition(criticalInjuryFixtureE, {
      fromState: "active",
      id: "critical-e:transition:shock-expired",
      recordedAt: "2026-08-13T12:00:03.000Z",
      reason: "Short shock duration elapsed",
      targetId: "critical-e:effect:shock",
      targetKind: "operational_effect",
      toState: "expired",
    });

    expect(getCriticalInjuryChildState(afterA, "critical-a:effect:stance")).toBe("expired");
    expect(afterA.injuries).toEqual([]);
    expect(afterA.physiologyProcesses).toEqual([]);
    expect(getCriticalInjuryChildState(afterE, "critical-e:effect:shock")).toBe("expired");
    expect(getCriticalInjuryChildState(afterE, "critical-e:injury:digits")).toBe("permanent");
    expect(getCriticalInjuryChildState(afterE, "critical-e:function:hand")).toBe(
      "severely_impaired",
    );
  });

  it("projects chest facts fail-closed without leaking hidden count or existence", () => {
    const gm = projectCriticalInjuryInformation({
      injuryCase: criticalInjuryFixtureC,
      viewer: "gm",
    });
    const player = projectCriticalInjuryInformation({
      audienceId: "player-a",
      injuryCase: criticalInjuryFixtureC,
      viewer: "player",
    });

    expect(gm.kind).toBe("gm");
    if (gm.kind !== "gm") throw new Error("Expected GM projection.");
    expect(gm.facts).toHaveLength(3);
    expect(gm.gmOnlyNotes).toEqual([
      "Fixture C selects no universal hidden-complication probability.",
    ]);
    expect(gm.facts.map((fact) => fact.id)).toContain("critical-c:fact:hidden-process");
    expect(player).toEqual({
      facts: [
        {
          id: "critical-c:fact:observable",
          label: "Observable condition",
          value: "A small chest puncture causes painful, guarded breathing.",
        },
      ],
      kind: "player",
    });
    expect(JSON.stringify(player)).not.toContain("internal");
    expect(JSON.stringify(player)).not.toContain("gm-note");
    expect(player).not.toHaveProperty("hiddenFactCount");
    expect(player).not.toHaveProperty("totalFactCount");
  });

  it("reveals only the selected canonical fact to the selected audience", () => {
    const revealed = appendCriticalInjuryTransition(criticalInjuryFixtureC, {
      audienceId: "player-a",
      fromState: "unrevealed",
      id: "critical-c:transition:reveal-internal",
      recordedAt: "2026-08-13T12:05:00.000Z",
      reason: "A capable examination established the fact",
      targetId: "critical-c:fact:hidden-process",
      targetKind: "information_fact",
      toState: "revealed",
    });

    const selectedAudience = projectCriticalInjuryInformation({
      audienceId: "player-a",
      injuryCase: revealed,
      viewer: "player",
    });
    const otherAudience = projectCriticalInjuryInformation({
      audienceId: "player-b",
      injuryCase: revealed,
      viewer: "player",
    });

    expect(selectedAudience.facts.map((fact) => fact.id)).toContain(
      "critical-c:fact:hidden-process",
    );
    expect(otherAudience.facts.map((fact) => fact.id)).not.toContain(
      "critical-c:fact:hidden-process",
    );
  });

  it("keeps unconsciousness, post-impact function, structure, and physiology separate", () => {
    expect(criticalInjuryFixtureD.operationalEffects[0]?.projections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "combat_state",
          state: { kind: "consciousness", value: "unconscious" },
        }),
      ]),
    );
    expect(criticalInjuryFixtureD.functionStates[0]).toMatchObject({
      consciousness: "unconscious",
      initialState: "no_meaningful_action",
      minimumConsequence: true,
    });
    expect(criticalInjuryFixtureD.functionStates[1]).toMatchObject({
      activationCondition: "after_consciousness_returns",
      consciousness: "conscious",
      initialState: "severely_impaired",
      minimumConsequence: true,
    });
    expect(criticalInjuryFixtureD.injuries[0]).toMatchObject({
      structuralKind: "concussion",
    });
    expect(criticalInjuryFixtureD.physiologyProcesses).toEqual([]);
  });

  it("uses explicit existing combat payloads and structured states for immediate effects", () => {
    const projections = REPRESENTATIVE_CRITICAL_INJURY_FIXTURES.flatMap((fixture) =>
      fixture.operationalEffects.flatMap((effect) => effect.projections),
    );
    const modifierPayloads = projections
      .filter((projection) => projection.kind === "combat_modifier")
      .map((projection) => projection.payload);
    const stateKinds = projections
      .filter((projection) => projection.kind === "combat_state")
      .map((projection) => projection.state.kind);

    expect(modifierPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "db_parry", kind: "numeric" }),
        expect.objectContaining({ category: "movement_modifier", kind: "numeric" }),
        expect.objectContaining({ effectKind: "loss_of_use", kind: "restriction" }),
        expect.objectContaining({ effectKind: "dropped_item", kind: "restriction" }),
        expect.objectContaining({ effectKind: "no_combat_action", kind: "restriction" }),
      ]),
    );
    expect(stateKinds).toEqual(
      expect.arrayContaining([
        "stance",
        "action_capacity",
        "item_control",
        "consciousness",
        "limb_function",
      ]),
    );
  });

  it("does not derive mechanics from source title or body text", () => {
    const { childManifest: _childManifest, ...acceptedOutcome } = criticalInjuryFixtureB.outcome;
    const rewrittenSourceCase = createCriticalInjuryCase({
      ...criticalInjuryFixtureB,
      outcome: {
        ...acceptedOutcome,
        originalSource: {
          ...acceptedOutcome.originalSource,
          criticalResult: {
            ...acceptedOutcome.originalSource.criticalResult,
            bodyText: "This prose says unconscious, no action, and instant death.",
            title: "No mechanics may be inferred from this title",
          },
        },
      },
    });

    expect(rewrittenSourceCase.operationalEffects).toEqual(
      criticalInjuryFixtureB.operationalEffects,
    );
    expect(rewrittenSourceCase.functionStates).toEqual(criticalInjuryFixtureB.functionStates);
    expect(rewrittenSourceCase.physiologyProcesses).toEqual(
      criticalInjuryFixtureB.physiologyProcesses,
    );
  });

  it("represents a catastrophic class without activating the legacy D4 fatal countdown", () => {
    expect(criticalInjuryFixtureF.physiologyProcesses).toEqual([
      expect.objectContaining({
        automation: "inert",
        processClass: "catastrophic",
        processKind: "fatal_process",
        ruleStatus: "terminal_semantics_unresolved",
      }),
    ]);
    expect(criticalInjuryFixtureF.outcome.creationRolls).toContainEqual(
      expect.objectContaining({
        formula: "d4",
        purpose: "legacy fatal countdown",
        use: "source_provenance_only",
      }),
    );
    expect(criticalInjuryFixtureF.physiologyProcesses[0]).not.toHaveProperty("nextCheckpoint");
    expect(criticalInjuryFixtureF.physiologyProcesses[0]).not.toHaveProperty("durationRounds");
    expect(criticalInjuryFixtureF.physiologyProcesses[0]).not.toHaveProperty("remainingTicks");
  });

  it("rejects invalid child and superseding lineage", () => {
    expect(() =>
      createCriticalInjuryCase({
        ...criticalInjuryFixtureA,
        informationFacts: [
          {
            ...criticalInjuryFixtureA.informationFacts[0]!,
            criticalOutcomeId: "wrong-outcome",
          },
        ],
        outcome: (() => {
          const { childManifest: _childManifest, ...outcome } = criticalInjuryFixtureA.outcome;
          return outcome;
        })(),
      }),
    ).toThrow("invalid outcome lineage");

    expect(() =>
      appendCriticalInjuryTransition(criticalInjuryFixtureA, {
        fromState: "active",
        id: "critical-a:transition:bad-supersedes",
        recordedAt: "2026-08-13T12:00:03.000Z",
        reason: "Invalid test transition",
        supersedesTransitionId: "missing-transition",
        targetId: "critical-a:effect:stance",
        targetKind: "operational_effect",
        toState: "expired",
      }),
    ).toThrow("invalid superseding lineage");
  });
});

describe("[#215 S6] the five source identifiers bind to one canonical vocabulary", () => {
  type UntilConditionDuration = {
    condition: string;
    conditionKind?: CanonicalCombatModifierConditionKind;
    kind: "until_condition";
  };

  function untilConditionDurations(): readonly UntilConditionDuration[] {
    return REPRESENTATIVE_CRITICAL_INJURY_FIXTURES.flatMap((fixture) =>
      fixture.operationalEffects
        .map((effect) => effect.duration)
        .filter(
          (duration): duration is UntilConditionDuration => duration.kind === "until_condition",
        ),
    );
  }

  it("binds `treated` only where the accepted source names that event", () => {
    const bindings = Object.fromEntries(
      untilConditionDurations().map((duration) => [duration.condition, duration.conditionKind]),
    );

    expect(bindings).toEqual({
      // Source `end_trigger: treated`.
      explicit_treatment_rule: "treated",
      // Source `end_trigger: treated_then_permanent`; only the `treated` stage is bound.
      hand_function_changes: "treated",
      // Source `end_trigger: special` — a positive statement that no mechanical rule exists.
      leg_function_changes: undefined,
      // Source's terminal transition is death, which requires a newly accepted rule.
      catastrophic_process_resolved: undefined,
    });
  });

  it("INVARIANT 4 — no identifier stands in for a duration that is not a condition at all", () => {
    // `authored_waking_condition` was a fake condition: the source states a rolled D4-hour duration
    // with `end_trigger: time` and names no condition whatsoever. It is now encoded as the rolled
    // quantity it is, so no condition identifier may reintroduce it.
    const identifiers = untilConditionDurations().map((duration) => duration.condition);

    expect(identifiers).not.toContain("authored_waking_condition");
    expect(identifiers).toHaveLength(4);
    expect(
      JSON.stringify(REPRESENTATIVE_CRITICAL_INJURY_FIXTURES).includes("authored_waking_condition"),
    ).toBe(false);
    // Nor may it come back as a Critical runtime end-event member.
    expect(combatCriticalEndEventSchema.safeParse("authored_waking_condition").success).toBe(false);
  });

  it("uses the canonical persisted vocabulary rather than a parallel encoding", () => {
    const canonical = new Set(canonicalCombatModifierConditionKindSchema.options);

    for (const duration of untilConditionDurations()) {
      if (duration.conditionKind === undefined) continue;
      expect(canonical.has(duration.conditionKind)).toBe(true);
    }
  });

  it("keeps the authored source identifier alongside the canonical binding", () => {
    // The identifier is provenance; the binding is meaning. Dropping either would make the
    // fixture unverifiable against its source range.
    for (const duration of untilConditionDurations()) {
      expect(duration.condition.length).toBeGreaterThan(0);
    }
    expect(untilConditionDurations()).toHaveLength(4);
  });
});

describe("[#215 S6] Critical-D carries its rolled D4-hour duration canonically", () => {
  // Both constants were measured by running the identical strip against the fixtures as they stood
  // immediately before this change, at `7048ef6496ee02264115f2328e4d3f6e416e5d36`.
  //
  // Forgejo #747 moved this golden from `39e20427c704d34955b30b0ce373cfef2570d0c46fa1219d1051235570cdf291`.
  // `fixtureSource` embeds the live Critical table's `result` object, so `sharp|arm|11` — one of
  // #747's 91 reader-facing title corrections, and the only fixture key among them — carries its
  // `title` into these fixtures. Measured by running this exact strip against both revisions:
  // 1,093 leaf fields compared, exactly one differs, and it is
  // `[4]/outcome/originalSource/criticalResult/title`
  // ("Finger loss; hand unusable; permanent_dex_loss; manual_skill_penalty" ->
  // "Finger loss; hand unusable; permanent Dex loss; manual skills penalised").
  // The pre-#747 strip reproduced the old golden byte for byte, which is what validates the new
  // one. No duration, label, projection or provenance range moved, so the invariant this test
  // states is intact and the assertion is unchanged.
  const DURATION_STRIPPED_FIXTURE_GOLDEN =
    "c687935daa517ee35d18ec50584bc121691c23c6650237543b1cdee1b390c271";
  const ROUND_BASED_FIXTURE_DURATION_COUNT = 4;

  const effect = criticalInjuryFixtureD.operationalEffects.find(
    (candidate) => candidate.id === "critical-d:effect:unconscious",
  );

  it("encodes the authored rolled hour duration, not a condition and not GM discretion", () => {
    expect(effect?.label).toBe("Unconscious");
    expect(effect?.duration).toEqual({
      kind: "rolled_time",
      rolled: { formula: "d4", unit: "hour", value: 3 },
    });
    // The two readings the ruling forbids. `rolled_time` is neither.
    expect(effect?.duration.kind).not.toBe("until_condition");
    expect(effect?.duration.kind).not.toBe("persistent");
  });

  it("uses the canonical rolled quantity shape and the canonical unit vocabulary", () => {
    const duration = effect?.duration;
    if (duration?.kind !== "rolled_time") throw new Error("Expected a rolled_time duration.");

    const parsed = canonicalCombatModifierRolledQuantitySchema.parse(duration.rolled);
    expect(parsed).toEqual(duration.rolled);
    expect(canonicalCombatModifierDurationUnitSchema.options).toContain(parsed.unit);
    expect(getCanonicalCombatModifierRolledDurationUnit(parsed)).toBe("hour");
  });

  it("keeps the duration and its accepted creation-roll evidence from drifting apart", () => {
    const duration = effect?.duration;
    if (duration?.kind !== "rolled_time") throw new Error("Expected a rolled_time duration.");
    const roll = criticalInjuryFixtureD.outcome.creationRolls.find(
      (candidate) => candidate.purpose === "source unconscious duration",
    );

    expect(roll?.use).toBe("accepted_mechanic");
    expect(roll?.formula).toBe(duration.rolled.formula);
    expect(roll?.total).toBe(duration.rolled.value);
  });

  it("INVARIANT 6 — no other fixture duration was reinterpreted by the widening", () => {
    const kinds = REPRESENTATIVE_CRITICAL_INJURY_FIXTURES.flatMap((fixture) =>
      fixture.operationalEffects.map((candidate) => candidate.duration.kind),
    );

    expect(kinds.filter((kind) => kind === "rolled_time")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "until_condition")).toHaveLength(4);
    expect(kinds.filter((kind) => kind === "rounds")).toHaveLength(
      ROUND_BASED_FIXTURE_DURATION_COUNT,
    );
  });

  it("changed the fixture content by exactly this one duration and nothing else", () => {
    // The equivalent of the pre-S6 strip golden: with every operational-effect duration removed, the
    // fixture content hashes to the same value it did before this change. Anything else that moved —
    // a label, a projection, a provenance range — would break this.
    const stripped = JSON.stringify(REPRESENTATIVE_CRITICAL_INJURY_FIXTURES, (key, value) =>
      key === "duration" ? undefined : value,
    );

    expect(createHash("sha256").update(stripped).digest("hex")).toBe(
      DURATION_STRIPPED_FIXTURE_GOLDEN,
    );
  });
});

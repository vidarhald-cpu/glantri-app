import { describe, expect, it } from "vitest";

import { scenarioParticipantCombatContextSchema } from "../campaign/scenario";
import {
  applyDistanceGeneratedObSkillModifier,
  buildDistanceGeneratedObSkillModifier,
  clearDistanceGeneratedObSkillModifierForPhase,
  removeDistanceGeneratedObSkillModifiers,
} from "./combatActionModifiers";
import {
  buildDefaultCombatDistanceEdge,
  calculateDistanceObPenalty,
  combatDistanceStateSchema,
  type CombatDistanceEdge,
  type CombatDistanceState,
  type CombatDistanceWeaponLike,
  ensureDistanceEdgesForParticipantPairs,
  getDefaultCombatDistanceForWeapons,
  getDistanceBetween,
  getDistanceEdgeBetweenParticipantAliases,
  getWeaponPreferredDistances,
  makeDistancePairKey,
  setDistanceBetween,
} from "./combatDistance";
import {
  buildCombatRoundAttackRollResult,
  clearCombatRoundStep,
  combatRoundStateSchema,
  getCombatRoundAttackDistanceModifierDetail,
  recordCombatRoundAttackResult,
  setCombatRoundPairDistance,
} from "./combatRoundManager";

describe("combat distance", () => {
  it("uses a canonical unordered pair key", () => {
    expect(makeDistancePairKey("participant-b", "participant-a")).toBe(
      makeDistancePairKey("participant-a", "participant-b"),
    );
  });

  it("sets and reads distance symmetrically", () => {
    const state = setDistanceBetween({
      distance: 3,
      participantAId: "participant-a",
      participantBId: "participant-b",
      source: "gm_set",
    });

    expect(getDistanceBetween(state, "participant-a", "participant-b")).toBe(3);
    expect(getDistanceBetween(state, "participant-b", "participant-a")).toBe(3);
  });

  it("rejects out-of-range distances", () => {
    expect(() =>
      setDistanceBetween({
        distance: 9,
        participantAId: "participant-a",
        participantBId: "participant-b",
        source: "gm_set",
      }),
    ).toThrow("Distance must be an integer from 0 to 8");
  });

  it("defaults to the longest preferred weapon distance", () => {
    const result = getDefaultCombatDistanceForWeapons({
      participantAWeapons: [{ preferredDistances: [1, 2] }],
      participantBWeapons: [{ preferredDistances: [3, 4] }],
    });

    expect(result).toEqual({ distance: 4 });
  });

  it("materializes pair defaults from the longest active weapon range metadata", () => {
    const longSwordBroadSword = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["gladiator", "scyrian"],
      weaponsByParticipantId: {
        gladiator: [{ range: "3.0" }],
        scyrian: [{ range: "2.0" }],
      },
    });
    const broadSwordBroadSword = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["scyrian-a", "scyrian-b"],
      weaponsByParticipantId: {
        "scyrian-a": [{ preferredDistances: [2] }],
        "scyrian-b": [{ range: "2.0" }],
      },
    });
    const spearLongSword = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["pikeman", "gladiator"],
      weaponsByParticipantId: {
        gladiator: [{ range: "3.0" }],
        pikeman: [{ preferredDistances: [4] }],
      },
    });

    expect(getDistanceBetween(longSwordBroadSword, "gladiator", "scyrian")).toBe(3);
    expect(getDistanceBetween(broadSwordBroadSword, "scyrian-a", "scyrian-b")).toBe(2);
    expect(getDistanceBetween(spearLongSword, "pikeman", "gladiator")).toBe(4);
  });

  it("does not fall back when one participant has valid weapon distance metadata", () => {
    const state = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["participant-a", "participant-b"],
      weaponsByParticipantId: {
        "participant-a": [{}],
        "participant-b": [{ range: "3.0" }],
      },
    });
    const edge = state.edges[makeDistancePairKey("participant-a", "participant-b")];

    expect(edge).toMatchObject({
      distance: 3,
      source: "default_weapon_reach",
    });
    expect(edge?.notes).toBeUndefined();
  });

  it("uses the weapon range field, not initiative, when materializing defaults", () => {
    const longSwordWithInitiative = { initiative: "7.0", range: "3.0" };
    const state = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["gladiator", "scyrian"],
      weaponsByParticipantId: {
        gladiator: [longSwordWithInitiative],
        scyrian: [{ range: "2.0" }],
      },
    });

    expect(getDistanceBetween(state, "gladiator", "scyrian")).toBe(3);
  });

  it("falls back safely when weapon distance metadata is missing or invalid", () => {
    const missingResult = getDefaultCombatDistanceForWeapons({
      participantAWeapons: [{}],
      participantBWeapons: [{}],
    });
    const invalidResult = getDefaultCombatDistanceForWeapons({
      participantAWeapons: [{ range: "2.5" }],
      participantBWeapons: [{}],
    });

    expect(missingResult.distance).toBe(2);
    expect(missingResult.notes).toContain("metadata was missing or invalid");
    expect(invalidResult.distance).toBe(2);
    expect(invalidResult.notes).toContain("metadata was missing or invalid");
  });

  it("parses existing weapon range strings into preferred distances", () => {
    expect(getWeaponPreferredDistances({ range: "2&3" })).toEqual([2, 3]);
    expect(getWeaponPreferredDistances({ range: "1/0*" })).toEqual([0, 1]);
    expect(getWeaponPreferredDistances({ range: "4.0" })).toEqual([4]);
  });

  it("parses whole-number weapon distance values without rounding fractions", () => {
    expect(getWeaponPreferredDistances({ range: "3.0" })).toEqual([3]);
    expect(getWeaponPreferredDistances({ range: "3" })).toEqual([3]);
    expect(getWeaponPreferredDistances({ range: 3 })).toEqual([3]);
    expect(getWeaponPreferredDistances({ preferredDistances: ["3.0"] })).toEqual([3]);
    expect(getWeaponPreferredDistances({ preferredDistances: ["3"] })).toEqual([3]);
    expect(getWeaponPreferredDistances({ preferredDistances: [3] })).toEqual([3]);
    expect(getWeaponPreferredDistances({ range: "2.5" })).toEqual([]);
  });

  it("calculates out-of-preferred OB penalties", () => {
    expect(calculateDistanceObPenalty(3, [3])).toBe(0);
    expect(calculateDistanceObPenalty(4, [3])).toBe(-2);
    expect(calculateDistanceObPenalty(1, [3])).toBe(-4);
    expect(calculateDistanceObPenalty(4, [1, 2])).toBe(-4);
    expect(calculateDistanceObPenalty(1, [3, 4])).toBe(-4);
  });

  it("creates phase-scoped generated OB/Skill modifiers for distance penalties", () => {
    const modifier = buildDistanceGeneratedObSkillModifier({
      actualDistance: 4,
      phase: "phase1",
      preferredDistances: [3],
      sourceActionId: "attack_parry",
      weaponName: "Long sword",
    });

    expect(modifier).toMatchObject({
      generated: true,
      id: "generated:distance:phase1:ob-skill",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      value: -2,
    });
    expect(modifier?.notes).toContain("Long sword preferred 3");
    expect(modifier?.notes).toContain("actual 4");
    expect(modifier?.notes).toContain("Skill/OB -2");
  });

  it("does not create a generated modifier inside preferred range", () => {
    expect(
      buildDistanceGeneratedObSkillModifier({
        actualDistance: 2,
        phase: "phase1",
        preferredDistances: [2],
      }),
    ).toBeUndefined();
  });

  it("replaces stale generated distance modifiers for a phase", () => {
    const context = scenarioParticipantCombatContextSchema.parse({
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [
          {
            generated: true,
            id: "generated:distance:phase1:ob-skill",
            scope: "until",
            sourcePhase: "phase1",
            sourceRule: "distance-ob-skill-phase1",
            value: -2,
          },
        ],
      },
    });
    const nextContext = applyDistanceGeneratedObSkillModifier({
      actualDistance: 4,
      combatContext: context,
      phase: "phase1",
      preferredDistances: [2],
    });

    expect(nextContext.modifierBuckets.situationObSkill).toHaveLength(1);
    expect(nextContext.modifierBuckets.situationObSkill[0]?.value).toBe(-4);
  });

  it("clears generated distance modifiers by phase or attack command facts", () => {
    const context = applyDistanceGeneratedObSkillModifier({
      actualDistance: 5,
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      phase: "phase1",
      preferredDistances: [3],
      sourceActionId: "attack_parry",
      weaponName: "Long sword",
    });

    expect(context.modifierBuckets.situationObSkill).toHaveLength(1);
    expect(
      clearDistanceGeneratedObSkillModifierForPhase({
        combatContext: context,
        phase: "phase1",
      }).modifierBuckets.situationObSkill,
    ).toEqual([]);
    expect(
      removeDistanceGeneratedObSkillModifiers({
        combatContext: context,
        command: {
          facts: {
            createdCombatModifierIds: ["generated:distance:phase1:ob-skill"],
          },
        },
      }).modifierBuckets.situationObSkill,
    ).toEqual([]);
  });

  it("stores and reads command-backed distance modifier details for attack results", () => {
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "attacker",
      defenderDb: 8,
      defenderParticipantId: "defender",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:00:00.000Z",
      weaponName: "Long sword",
    });
    const state = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
        facts: {
          createdCombatModifierIds: ["generated:distance:phase1:ob-skill"],
          distanceModifier: {
            actualDistance: 5,
            createdCombatModifierIds: ["generated:distance:phase1:ob-skill"],
            modifierId: "generated:distance:phase1:ob-skill",
            nearestPreferredDistance: 3,
            preferredDistances: [3],
            value: -4,
            weaponName: "Long sword",
          },
        },
      },
      participantId: "attacker",
      result: attackResult,
      state: combatRoundStateSchema.parse({
        currentStep: "phase_1_actions",
        participants: [
          { label: "Attacker", participantId: "attacker" },
          { label: "Defender", participantId: "defender" },
        ],
        roundNumber: 1,
      }),
      submittedBy: "gm",
    });

    expect(getCombatRoundAttackDistanceModifierDetail({ result: attackResult, state })).toEqual({
      actualDistance: 5,
      createdCombatModifierIds: ["generated:distance:phase1:ob-skill"],
      modifierId: "generated:distance:phase1:ob-skill",
      nearestPreferredDistance: 3,
      preferredDistances: [3],
      value: -4,
      weaponName: "Long sword",
    });
  });

  it("lazily creates one default edge for each active participant pair", () => {
    const state = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["participant-a", "participant-b", "participant-c"],
      weaponsByParticipantId: {
        "participant-a": [{ preferredDistances: [1] }],
        "participant-b": [{ preferredDistances: [2] }],
        "participant-c": [{ preferredDistances: [3] }],
      },
    });

    expect(Object.keys(state.edges)).toHaveLength(3);
    expect(getDistanceBetween(state, "participant-a", "participant-c")).toBe(3);
  });

  it("defaults the Gladiator and Scyrian cavalry pair from Long sword range metadata", () => {
    const state = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["encounter-gladiator", "encounter-scyrian"],
      weaponsByParticipantId: {
        "encounter-gladiator": [{ range: "3.0" }],
        "encounter-scyrian": [{}],
      },
    });
    const pairKey = makeDistancePairKey("encounter-gladiator", "encounter-scyrian");

    expect(state.edges[pairKey]).toMatchObject({
      distance: 3,
      source: "default_weapon_reach",
    });
    expect(state.edges[pairKey]?.notes).toBeUndefined();
    expect(getDistanceBetween(state, "encounter-gladiator", "encounter-scyrian")).toBe(3);
  });

  it("refreshes fallback default edges when weapon metadata becomes available", () => {
    const fallbackState = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["encounter-gladiator", "encounter-scyrian"],
    });
    const refreshedState = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["encounter-gladiator", "encounter-scyrian"],
      refreshFallbackDefaultEdges: true,
      state: fallbackState,
      weaponsByParticipantId: {
        "encounter-gladiator": [{ range: "3.0" }],
        "encounter-scyrian": [{ range: "2.0" }],
      },
    });
    const pairKey = makeDistancePairKey("encounter-gladiator", "encounter-scyrian");

    expect(fallbackState.edges[pairKey]).toMatchObject({
      distance: 2,
      source: "default_weapon_reach",
    });
    expect(fallbackState.edges[pairKey]?.notes).toContain("metadata was missing");
    expect(refreshedState.edges[pairKey]).toMatchObject({
      distance: 3,
      source: "default_weapon_reach",
    });
    expect(refreshedState.edges[pairKey]?.notes).toBeUndefined();
  });

  it("resolves distance edges through participant, scenario participant, and character aliases", () => {
    const state = setDistanceBetween({
      distance: 3,
      participantAId: "encounter-gladiator",
      participantBId: "encounter-scyrian",
      source: "gm_set",
    });

    expect(
      getDistanceEdgeBetweenParticipantAliases({
        participantA: {
          characterId: "character-gladiator",
          participantId: "encounter-gladiator",
          scenarioParticipantId: "scenario-gladiator",
        },
        participantB: {
          characterId: "character-scyrian",
          participantId: "encounter-scyrian",
          scenarioParticipantId: "scenario-scyrian",
        },
        state,
      })?.distance,
    ).toBe(3);
    expect(
      getDistanceEdgeBetweenParticipantAliases({
        participantA: { characterId: "character-gladiator" },
        participantB: { characterId: "character-scyrian" },
        state: setDistanceBetween({
          distance: 4,
          participantAId: "character-gladiator",
          participantBId: "character-scyrian",
          source: "gm_set",
        }),
      })?.distance,
    ).toBe(4);
  });

  it("GM-set distance overrides a default edge and Clear restores the default", () => {
    const defaultDistanceState = ensureDistanceEdgesForParticipantPairs({
      participantIds: ["participant-a", "participant-b"],
      weaponsByParticipantId: {
        "participant-a": [{ preferredDistances: [1, 2] }],
        "participant-b": [{ preferredDistances: [4] }],
      },
    });
    const roundState = combatRoundStateSchema.parse({
      currentStep: "select_actions",
      distanceState: defaultDistanceState,
      participants: [
        { label: "A", participantId: "participant-a" },
        { label: "B", participantId: "participant-b" },
      ],
      roundNumber: 1,
    });
    const withGmDistance = setCombatRoundPairDistance({
      command: {
        createdAt: "2026-07-03T10:00:00.000Z",
      },
      distance: 1,
      participantAId: "participant-a",
      participantBId: "participant-b",
      state: roundState,
    });

    expect(getDistanceBetween(withGmDistance.distanceState, "participant-a", "participant-b")).toBe(
      1,
    );

    const cleared = clearCombatRoundStep({
      state: withGmDistance,
      step: "select_actions",
    });

    expect(getDistanceBetween(cleared.distanceState, "participant-a", "participant-b")).toBe(4);
    expect(cleared.commands).toEqual([]);
  });
});

// #1047: test-local copy of the original O(N^4) implementation (re-parses the whole edge
// record per added edge). The optimized implementation must match it byte for byte.
function originalEnsureDistanceEdgesForParticipantPairs(input: {
  lastChangedPhase?: string;
  lastChangedRound?: number;
  participantIds: readonly string[];
  refreshFallbackDefaultEdges?: boolean;
  state?: CombatDistanceState;
  weaponsByParticipantId?: Record<string, readonly (CombatDistanceWeaponLike | undefined | null)[]>;
}): CombatDistanceState {
  let nextState = combatDistanceStateSchema.parse(input.state ?? {});

  for (let leftIndex = 0; leftIndex < input.participantIds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < input.participantIds.length;
      rightIndex += 1
    ) {
      const participantAId = input.participantIds[leftIndex];
      const participantBId = input.participantIds[rightIndex];

      if (!participantAId || !participantBId) {
        continue;
      }

      const pairKey = makeDistancePairKey(participantAId, participantBId);
      const existingEdge = nextState.edges[pairKey];

      if (
        existingEdge &&
        (!input.refreshFallbackDefaultEdges ||
          existingEdge.source !== "default_weapon_reach" ||
          !existingEdge.notes?.includes("metadata was missing or invalid"))
      ) {
        continue;
      }

      const edge = buildDefaultCombatDistanceEdge({
        lastChangedPhase: input.lastChangedPhase,
        lastChangedRound: input.lastChangedRound,
        participantAId,
        participantAWeapons: input.weaponsByParticipantId?.[participantAId],
        participantBId,
        participantBWeapons: input.weaponsByParticipantId?.[participantBId],
      });

      nextState = combatDistanceStateSchema.parse({
        edges: {
          ...nextState.edges,
          [edge.pairKey]: edge,
        },
      });
    }
  }

  return nextState;
}

describe("ensureDistanceEdgesForParticipantPairs equivalence and performance (#1047)", () => {
  const ids = (count: number) => Array.from({ length: count }, (_, index) => `p-${index}`);
  const weaponKinds: Record<string, readonly CombatDistanceWeaponLike[]> = {
    spear: [{ preferredDistances: [3, 4] }],
    sword: [{ range: "1-2" }],
    dagger: [{ range: 1 }],
    bow: [{ preferredDistances: [6, 7, 8] }],
  };
  const weaponsFor = (participantIds: readonly string[], mode: "armed" | "unarmed" | "mixed") => {
    const kinds = Object.values(weaponKinds);
    const result: Record<string, readonly CombatDistanceWeaponLike[]> = {};

    participantIds.forEach((id, index) => {
      if (mode === "armed" || (mode === "mixed" && index % 2 === 0)) {
        result[id] = kinds[index % kinds.length] ?? [];
      }
    });

    return result;
  };
  const fallbackEdge = (a: string, b: string): CombatDistanceEdge =>
    buildDefaultCombatDistanceEdge({ participantAId: a, participantBId: b });
  const buildState = (
    participantIds: readonly string[],
    kind: "empty" | "preexisting" | "stale",
  ): CombatDistanceState | undefined => {
    if (kind === "empty") {
      return undefined;
    }

    const edges: Record<string, CombatDistanceEdge> = {};

    for (let index = 0; index + 1 < participantIds.length; index += 3) {
      const a = participantIds[index] as string;
      const b = participantIds[index + 1] as string;
      const edge =
        kind === "stale"
          ? fallbackEdge(a, b)
          : setDistanceBetween({
              distance: 4,
              participantAId: a,
              participantBId: b,
              source: "gm_set",
            }).edges[makeDistancePairKey(a, b)];

      if (edge) {
        edges[edge.pairKey] = edge;
      }
    }

    // A pair outside the participant list must be preserved in place.
    const outsider = fallbackEdge("zz-outside-a", "zz-outside-b");
    edges[outsider.pairKey] = outsider;

    return { edges };
  };

  // The original takes ~18s at 100 participants, so 100 runs a representative subset of
  // cases (one per state kind, covering armed/unarmed/mixed and both refresh settings);
  // 5-50 run the full matrix.
  const largeCases: readonly [string, string, boolean][] = [
    ["empty", "armed", false],
    ["preexisting", "unarmed", true],
    ["stale", "mixed", true],
  ];
  const cases: [
    number,
    "empty" | "preexisting" | "stale",
    "armed" | "unarmed" | "mixed",
    boolean,
  ][] = [];

  for (const count of [5, 10, 25, 50]) {
    for (const stateKind of ["empty", "preexisting", "stale"] as const) {
      for (const mode of ["armed", "unarmed", "mixed"] as const) {
        for (const refresh of [false, true]) {
          cases.push([count, stateKind, mode, refresh]);
        }
      }
    }
  }

  for (const [stateKind, mode, refresh] of largeCases) {
    cases.push([100, stateKind as "empty", mode as "armed", refresh]);
  }

  for (const [count, stateKind, mode, refresh] of cases) {
    it(`matches the original: ${count} participants, ${stateKind} state, ${mode}, refresh=${refresh}`, () => {
      const participantIds = ids(count);
      const input = {
        lastChangedPhase: "declaration",
        lastChangedRound: 2,
        participantIds,
        refreshFallbackDefaultEdges: refresh,
        state: buildState(participantIds, stateKind),
        weaponsByParticipantId: weaponsFor(participantIds, mode),
      };

      const actual = ensureDistanceEdgesForParticipantPairs(input);
      const expected = originalEnsureDistanceEdgesForParticipantPairs(input);

      expect(actual).toEqual(expected);
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    }, 120_000);
  }

  it("matches the original (result or thrown error) for degenerate participant lists", () => {
    const outcome = (
      run: (input: { participantIds: readonly string[] }) => CombatDistanceState,
      participantIds: string[],
    ) => {
      try {
        return JSON.stringify(run({ participantIds }));
      } catch (error) {
        return `throws: ${(error as Error).message}`;
      }
    };

    for (const participantIds of [[], ["a"], ["a", "a", "b"], ["a", "", "b"], ["b", "a"]]) {
      expect(outcome(ensureDistanceEdgesForParticipantPairs, participantIds)).toBe(
        outcome(originalEnsureDistanceEdgesForParticipantPairs, participantIds),
      );
    }
  });

  it("does not mutate the input state", () => {
    const participantIds = ids(5);
    const state = buildState(participantIds, "stale") as CombatDistanceState;
    const before = JSON.stringify(state);

    ensureDistanceEdgesForParticipantPairs({
      participantIds,
      refreshFallbackDefaultEdges: true,
      state,
    });

    expect(JSON.stringify(state)).toBe(before);
  });

  it("stays within the performance budget at 100 participants", () => {
    // The original takes ~18s here; the single-parse version takes ~20ms. The 3000ms budget leaves >10x headroom for loaded CI machines.
    const participantIds = ids(100);
    const started = performance.now();
    const result = ensureDistanceEdgesForParticipantPairs({
      participantIds,
      weaponsByParticipantId: weaponsFor(participantIds, "mixed"),
    });
    const elapsed = performance.now() - started;

    expect(Object.keys(result.edges)).toHaveLength((100 * 99) / 2);
    expect(elapsed).toBeLessThan(3000);
  });
});

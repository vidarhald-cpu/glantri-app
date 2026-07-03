import { describe, expect, it } from "vitest";

import { scenarioParticipantCombatContextSchema } from "../campaign/scenario";
import {
  applyDistanceGeneratedObSkillModifier,
  buildDistanceGeneratedObSkillModifier,
} from "./combatActionModifiers";
import {
  calculateDistanceObPenalty,
  ensureDistanceEdgesForParticipantPairs,
  getDefaultCombatDistanceForWeapons,
  getDistanceBetween,
  getDistanceEdgeBetweenParticipantAliases,
  getWeaponPreferredDistances,
  makeDistancePairKey,
  setDistanceBetween,
} from "./combatDistance";
import {
  clearCombatRoundStep,
  combatRoundStateSchema,
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
    expect(calculateDistanceObPenalty(2, [2])).toBe(0);
    expect(calculateDistanceObPenalty(4, [2])).toBe(-4);
    expect(calculateDistanceObPenalty(1, [2])).toBe(-2);
    expect(calculateDistanceObPenalty(4, [1, 2])).toBe(-4);
    expect(calculateDistanceObPenalty(1, [3, 4])).toBe(-4);
  });

  it("creates phase-scoped generated OB/Skill modifiers for distance penalties", () => {
    const modifier = buildDistanceGeneratedObSkillModifier({
      actualDistance: 4,
      phase: "phase1",
      preferredDistances: [2],
      sourceActionId: "attack_parry",
    });

    expect(modifier).toMatchObject({
      generated: true,
      id: "generated:distance:phase1:ob-skill",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      value: -4,
    });
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

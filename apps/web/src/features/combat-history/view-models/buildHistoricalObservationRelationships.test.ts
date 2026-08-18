import { describe, expect, it } from "vitest";

import { buildHistoricalObservationRelationships } from "./buildHistoricalObservationRelationships";

const relationship = {
  bestBonus: 1,
  completedAttempts: 1,
  id: "observation:observer:target",
  observerParticipantId: "observer",
  roundsTowardNextAttempt: 0,
  targetParticipantId: "target",
} as const;

const progressEvent = {
  facts: {
    involvedOutcome: {
      bestBonusAfter: 1,
      completedAttempts: 1,
      observationStatus: "progress",
      relationshipId: relationship.id,
      requiredQualifyingRounds: 6,
      roundsTowardNextAttempt: 1,
      targetParticipantId: "target",
    },
  },
  id: "observation-progress",
  ownerParticipantId: "observer",
  sequence: 7,
  step: "round_summary",
  type: "observation",
} as const;

describe("buildHistoricalObservationRelationships", () => {
  it("keeps player-safe history at the prior relationship until the selected SU step", () => {
    const declaration = buildHistoricalObservationRelationships({
      baselineRelationships: [relationship],
      events: [progressEvent],
      observerParticipantId: "observer",
      selectedStep: "select_actions",
    });
    const summary = buildHistoricalObservationRelationships({
      baselineRelationships: [relationship],
      events: [progressEvent],
      observerParticipantId: "observer",
      selectedStep: "round_summary",
    });

    expect(declaration.relationships[0]?.roundsTowardNextAttempt).toBe(0);
    expect(declaration.visibleEventIds).toEqual([]);
    expect(summary.relationships[0]?.roundsTowardNextAttempt).toBe(1);
    expect(summary.visibleEventIds).toEqual(["observation-progress"]);
  });

  it("cannot disclose a target observation when the player-safe event and baseline are absent", () => {
    expect(
      buildHistoricalObservationRelationships({
        events: [],
        observerParticipantId: "target",
        selectedStep: "round_summary",
      }).relationships,
    ).toEqual([]);
  });
});

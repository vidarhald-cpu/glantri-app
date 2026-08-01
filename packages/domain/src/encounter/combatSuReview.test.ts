import { describe, expect, it } from "vitest";

import {
  assertCanonicalCombatSuReviewEffectVersions,
  canonicalCombatSuReviewSchema,
} from "./combatSuReview";

const review = canonicalCombatSuReviewSchema.parse({
  canonicalCutoff: 17,
  effectVersions: { "effect-ce": 2, "effect-stunned": 1 },
  participantId: "participant-1",
  proposals: [
    {
      automatic: true,
      effectId: "effect-ce",
      expectedEffectVersion: 2,
      id: "proposal-ce",
      mayOverride: false,
      nextDuration: {
        creationRoundCounts: true,
        kind: "rounds",
        remaining: 1,
        startRound: 3,
        startSequence: 4,
        transitionBoundary: "round_end_review",
      },
      nextState: "active",
      owner: "su",
      priorDuration: {
        creationRoundCounts: true,
        kind: "rounds",
        remaining: 2,
        startRound: 3,
        startSequence: 4,
        transitionBoundary: "round_end_review",
      },
      priorState: "active",
      reason: "duration_decremented",
      transitionType: "update",
    },
  ],
  requirements: [
    {
      blocksReview: false,
      completeness: "unsupported_ambiguity",
      effectId: "effect-stunned",
      id: "requirement-stunned",
      kind: "recovery_check",
      label: "Stunned: pending canonical resolution",
      owner: "source_process",
      resolved: false,
    },
  ],
  reviewId: "su-review-1",
  roundNumber: 4,
  schemaVersion: 1,
  state: "ready",
});

describe("canonical SU review", () => {
  it("keeps typed duration proposals separate from unresolved recovery requirements", () => {
    expect(review.proposals[0]).toMatchObject({
      effectId: "effect-ce",
      expectedEffectVersion: 2,
      nextDuration: { kind: "rounds", remaining: 1 },
      reason: "duration_decremented",
    });
    expect(review.requirements[0]).toMatchObject({
      blocksReview: false,
      completeness: "unsupported_ambiguity",
      kind: "recovery_check",
    });
  });

  it("accepts exact effect versions and rejects a stale participant review", () => {
    expect(() =>
      assertCanonicalCombatSuReviewEffectVersions({
        currentVersions: { "effect-ce": 2, "effect-stunned": 1 },
        review,
      }),
    ).not.toThrow();
    expect(() =>
      assertCanonicalCombatSuReviewEffectVersions({
        currentVersions: { "effect-ce": 3, "effect-stunned": 1 },
        review,
      }),
    ).toThrow("Persistent effect state changed while the SU review was open.");
  });
});

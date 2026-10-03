import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  buildCombatRoundEndPublicChronology,
  type CombatEffect,
  type RoundEndParticipantReview,
} from "@glantri/domain";

import { RoundEndEffectsChronology } from "./RoundEndEffectsChronology";

describe("Round End Effects public chronology", () => {
  it("orders approved fields while keeping populated private lifecycle data out of rendering", () => {
    const effects = [
      {
        id: "effect-1",
        targetParticipantId: "hero",
        status: "active",
        description: "Visible fatigue",
        duration: "2 rounds",
        canonicalTransitions: [
          {
            gmOverride: { reasonCode: "SECRET_CORRECTION_REASON", userId: "SECRET_GM_ID" },
            privateDiagnostic: "SECRET_DIAGNOSTIC",
          },
        ],
        correctionLedger: "SECRET_LIFECYCLE_STATE",
      },
      {
        id: "other-effect",
        targetParticipantId: "other",
        status: "active",
        description: "SECRET_OTHER_PARTICIPANT",
        duration: "2 rounds",
      },
    ] as unknown as CombatEffect[];
    const review = {
      participantId: "hero",
      proposedEffects: [
        {
          accepted: true,
          effectId: "effect-1",
          id: "duration-1",
          label: "Visible fatigue",
          previousDuration: "2 rounds",
          nextDuration: "1 round",
          gmOverride: { reasonCode: "SECRET_REVIEW_REASON", userId: "SECRET_REVIEW_GM" },
        },
      ],
      proposedRemovals: [
        {
          accepted: true,
          effectId: "effect-2",
          id: "expiration-1",
          label: "Visible stun",
          previousDuration: "1 round",
        },
      ],
      proposedHealthRolls: [
        {
          accepted: true,
          id: "health-1",
          label: "Health check",
          result: { success: true, rolledByUserId: "SECRET_ROLL_USER" },
          status: "rolled",
        },
      ],
      canonicalReview: {
        proposals: [],
        requirements: [
          {
            id: "check-1",
            kind: "recovery_check",
            label: "Recovery check",
            resolved: false,
            privateDiagnostic: "SECRET_REQUIREMENT_DIAGNOSTIC",
          },
        ],
      },
      warnings: ["SECRET_REVIEW_WARNING"],
    } as unknown as RoundEndParticipantReview;

    const moments = buildCombatRoundEndPublicChronology({
      effects,
      ownerParticipantIds: ["hero"],
      review,
    });
    const otherReviewMoments = buildCombatRoundEndPublicChronology({
      effects,
      ownerParticipantIds: ["hero"],
      review: {
        ...review,
        participantId: "other",
        warnings: ["SECRET_OTHER_REVIEW_WARNING"],
      },
    });
    expect(otherReviewMoments).toEqual([]);
    expect(moments.map((moment) => moment.kind)).toEqual([
      "active_timed_effect",
      "active_timed_effect",
      "countdown_checkpoint",
      "expiration",
      "due_check",
      "due_check",
      "result",
    ]);
    const html = renderToStaticMarkup(<RoundEndEffectsChronology moments={moments} />);
    expect(html).toContain("Visible fatigue");
    expect(html).toContain("2 rounds → 1 round");
    expect(html).toContain("Visible stun");
    expect(html).toContain("Expired");
    expect(html).toContain("Recovery check");
    expect(html).toContain("Succeeded");
    for (const forbidden of [
      "canonicalTransitions",
      "gmOverride",
      "privateDiagnostic",
      "SECRET_CORRECTION_REASON",
      "SECRET_GM_ID",
      "SECRET_DIAGNOSTIC",
      "SECRET_OTHER_PARTICIPANT",
      "SECRET_REVIEW_REASON",
      "SECRET_REVIEW_GM",
      "SECRET_ROLL_USER",
      "SECRET_REQUIREMENT_DIAGNOSTIC",
      "SECRET_REVIEW_WARNING",
      "SECRET_LIFECYCLE_STATE",
      "SECRET_OTHER_REVIEW_WARNING",
    ]) {
      expect(JSON.stringify(moments)).not.toContain(forbidden);
      expect(html).not.toContain(forbidden);
    }
  });
});

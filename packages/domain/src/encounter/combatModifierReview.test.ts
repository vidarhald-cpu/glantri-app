import { describe, expect, it } from "vitest";

import {
  CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
  CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
  CanonicalCombatModifierReviewError,
  canonicalCombatModifierReviewInputSchema,
  commitCanonicalCombatModifierReview,
  getCanonicalCombatModifierReviewResultLabel,
  getCanonicalCombatModifierReviewState,
  projectCanonicalCombatModifierReviewPublicResult,
  type CanonicalCombatModifierEffect,
  type CanonicalCombatModifierReviewInput,
} from "../index";

function effect(
  overrides: Partial<CanonicalCombatModifierEffect> = {},
): CanonicalCombatModifierEffect {
  return {
    applicability: {
      combatWide: true,
      encounterId: "encounter-1",
      rollPurposes: [],
      roundNumber: 2,
    },
    createdAt: "2026-08-01T08:00:00.000Z",
    createdRevision: "revision-1",
    createdSequence: 4,
    id: "effect-1",
    lifecycle: {
      duration: {
        creationRoundCounts: true,
        kind: "rounds",
        remaining: 2,
        startRound: 2,
        startSequence: 4,
        transitionBoundary: "round_boundary",
      },
      state: "active",
    },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: "participant-1",
    payload: {
      category: "general_fatigue",
      contributionScope: "calculation",
      kind: "numeric",
      unit: "percentage",
      value: -2,
    },
    provenanceCompleteness: "complete",
    publicLabel: "Combat Experience",
    schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    sourceFamily: "combat_experience",
    sourceReferences: { effectId: "effect-1" },
    version: 1,
    visibility: { audience: "public", sourceIdentity: "public" },
    ...overrides,
  };
}

function review(
  overrides: Partial<CanonicalCombatModifierReviewInput> = {},
): CanonicalCombatModifierReviewInput {
  return canonicalCombatModifierReviewInputSchema.parse({
    automaticProposals: [],
    canonicalCutoff: 12,
    decisions: [],
    encounterId: "encounter-1",
    expectedEncounterRevision: "revision-2",
    inputEffects: [effect()],
    participantId: "participant-1",
    phase: "M1",
    requiredRolls: [],
    reviewId: "review-1",
    roundNumber: 2,
    schemaVersion: CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
    ...overrides,
  });
}

function commit(input: CanonicalCombatModifierReviewInput) {
  return commitCanonicalCombatModifierReview({
    acceptedRevision: "revision-2",
    acceptedSequence: 13,
    commandId: "command-1",
    review: input,
  });
}

describe("canonical combat modifier review", () => {
  it("loads exact participant state for M1 and M2", () => {
    expect(review().inputEffects[0]).toMatchObject({ id: "effect-1", version: 1 });
    expect(review({ phase: "M2" }).phase).toBe("M2");
  });

  it("creates a no-change transaction without redundant versions", () => {
    const transaction = commit(review());
    expect(transaction.changes).toEqual([]);
    expect(transaction.transitions).toEqual([]);
    expect(transaction.outputEffects).toEqual(review().inputEffects);
    expect(getCanonicalCombatModifierReviewResultLabel(transaction)).toBe("No changes");
  });

  it("rejects a deliberately injected foreign effect without rewriting its owner", () => {
    const foreign = effect({ id: "foreign-effect", ownerParticipantId: "participant-2" });
    expect(() => commit(review({ inputEffects: [effect(), foreign] }))).toThrowError(
      /only contain effects owned by its participant/i,
    );
    expect(foreign.ownerParticipantId).toBe("participant-2");
  });

  it("projects accepted changes without lifecycle identities or private provenance", () => {
    const transaction = commit(
      review({
        decisions: [
          {
            decisionId: "edit-1",
            effectId: "effect-1",
            expectedVersion: 1,
            kind: "edit",
            nextDuration: {
              creationRoundCounts: true,
              kind: "rounds",
              remaining: 1,
              startRound: 2,
              startSequence: 4,
              transitionBoundary: "round_boundary",
            },
            nextPayload: {
              category: "general_fatigue",
              contributionScope: "calculation",
              kind: "numeric",
              unit: "percentage",
              value: -1,
            },
          },
        ],
        publicNote: "Adjusted by the GM.",
      }),
    );
    const result = projectCanonicalCombatModifierReviewPublicResult({
      transaction,
      viewer: {
        controlledParticipantIds: new Set(["participant-1"]),
        isGm: false,
        visibleParticipantIds: new Set(["participant-1"]),
      },
    });

    expect(result).toEqual({
      changed: true,
      changes: [
        {
          category: "General/Fatigue",
          changeType: "edited",
          duration: "1 round",
          label: "Combat Experience",
          previousDuration: "2 rounds",
          previousValue: -2,
          unit: "percentage",
          value: -1,
        },
      ],
      publicNote: "Adjusted by the GM.",
      resultLabel: "Changes accepted",
      schemaVersion: 1,
    });
    expect(JSON.stringify(result)).not.toContain("effect-1");
    expect(JSON.stringify(result)).not.toContain("revision-1");

    const hidden = commit(
      review({
        decisions: [
          {
            decisionId: "remove-hidden",
            effectId: "effect-1",
            expectedVersion: 1,
            kind: "remove",
          },
        ],
        inputEffects: [
          effect({ visibility: { audience: "gm", sourceIdentity: "hidden" } }),
        ],
      }),
    );
    expect(
      projectCanonicalCombatModifierReviewPublicResult({
        transaction: hidden,
        viewer: {
          controlledParticipantIds: new Set(["participant-1"]),
          isGm: false,
          visibleParticipantIds: new Set(["participant-1"]),
        },
      }),
    ).toMatchObject({ changed: false, changes: [], resultLabel: "No changes" });
  });

  it("accepts typed expiry and duration proposals with exact versions", () => {
    const expiry = commit(
      review({
        automaticProposals: [
          {
            effectId: "effect-1",
            expectedVersion: 1,
            id: "proposal-1",
            mayOverride: true,
            nextState: "expired",
            owner: "modifier_review",
            reason: "natural_expiry",
            transitionType: "expire",
          },
        ],
        decisions: [
          { decisionId: "decision-1", kind: "accept_proposal", proposalId: "proposal-1" },
        ],
      }),
    );
    expect(expiry.changes[0]).toMatchObject({
      effectId: "effect-1",
      kind: "expired",
      nextVersion: 2,
      priorVersion: 1,
    });
    expect(expiry.transitions[0]).toMatchObject({
      acceptedRevision: "revision-2",
      acceptedSequence: 13,
      reason: "natural_expiry",
      transitionType: "expire",
    });

    const decremented = commit(
      review({
        automaticProposals: [
          {
            effectId: "effect-1",
            expectedVersion: 1,
            id: "proposal-2",
            mayOverride: false,
            nextDuration: {
              creationRoundCounts: true,
              kind: "rounds",
              remaining: 1,
              startRound: 2,
              startSequence: 4,
              transitionBoundary: "round_boundary",
            },
            nextState: "active",
            owner: "modifier_review",
            reason: "duration_decremented",
            transitionType: "update",
          },
        ],
        decisions: [
          { decisionId: "decision-2", kind: "accept_proposal", proposalId: "proposal-2" },
        ],
      }),
    );
    expect(decremented.outputEffects[0]?.lifecycle.duration).toMatchObject({
      kind: "rounds",
      remaining: 1,
    });
  });

  it("records an allowed GM retention as a versioned override", () => {
    const transaction = commit(
      review({
        automaticProposals: [
          {
            effectId: "effect-1",
            expectedVersion: 1,
            id: "proposal-1",
            mayOverride: true,
            nextState: "expired",
            owner: "modifier_review",
            reason: "natural_expiry",
            transitionType: "expire",
          },
        ],
        decisions: [
          {
            decisionId: "decision-1",
            kind: "retain",
            proposalId: "proposal-1",
            publicNote: "Retained by GM",
          },
        ],
      }),
    );
    expect(transaction.changes).toEqual([
      expect.objectContaining({ kind: "retained", nextVersion: 2, priorVersion: 1 }),
    ]);
    expect(transaction.transitions).toEqual([
      expect.objectContaining({
        publicNote: "Retained by GM",
        reason: "review_rejected",
        transitionType: "update",
      }),
    ]);
  });

  it("adds numeric and nonnumeric effects with explicit typed payloads", () => {
    const numeric = effect({
      id: "effect-added",
      publicLabel: "Poor footing",
      sourceFamily: "manual",
      sourceReferences: {},
      version: 1,
    });
    const condition = effect({
      id: "condition-added",
      payload: {
        effectKind: "action_limited",
        kind: "restriction",
        operationalRestriction: "limited_action",
      },
      publicLabel: "Limited action",
      sourceFamily: "manual",
      sourceReferences: {},
      version: 1,
    });
    const transaction = commit(
      review({
        decisions: [
          { decisionId: "add-1", effect: numeric, kind: "add" },
          { decisionId: "add-2", effect: condition, kind: "add" },
        ],
      }),
    );
    expect(transaction.changes.map((change) => change.kind)).toEqual(["added", "added"]);
    expect(transaction.outputEffects).toHaveLength(3);
  });

  it("edits value and duration through one versioned transition", () => {
    const transaction = commit(
      review({
        decisions: [
          {
            decisionId: "edit-1",
            effectId: "effect-1",
            expectedVersion: 1,
            kind: "edit",
            nextDuration: {
              creationRoundCounts: true,
              kind: "rounds",
              remaining: 1,
              startRound: 2,
              startSequence: 4,
              transitionBoundary: "round_boundary",
            },
            nextPayload: {
              category: "general_fatigue",
              contributionScope: "calculation",
              kind: "numeric",
              unit: "percentage",
              value: -1,
            },
          },
        ],
      }),
    );
    expect(transaction.outputEffects[0]).toMatchObject({
      payload: { unit: "percentage", value: -1 },
      version: 2,
    });
    expect(transaction.transitions).toHaveLength(1);
  });

  it("requires replacement for unsafe category or unit changes", () => {
    expect(() =>
      commit(
        review({
          decisions: [
            {
              decisionId: "edit-1",
              effectId: "effect-1",
              expectedVersion: 1,
              kind: "edit",
              nextPayload: {
                category: "db_parry",
                contributionScope: "calculation",
                kind: "numeric",
                unit: "flat_db",
                value: -1,
              },
            },
          ],
        }),
      ),
    ).toThrowError(/requires replacement/i);
  });

  it("removes effects without deleting provenance", () => {
    const transaction = commit(
      review({
        decisions: [
          {
            decisionId: "remove-1",
            effectId: "effect-1",
            expectedVersion: 1,
            kind: "remove",
            publicNote: "Cleared by GM",
          },
        ],
      }),
    );
    expect(transaction.outputEffects[0]).toMatchObject({
      lifecycle: { state: "removed" },
      sourceFamily: "combat_experience",
      version: 2,
    });
    expect(transaction.transitions[0]).toMatchObject({ reason: "gm_removed" });
  });

  it("rejects stale effect and encounter revisions without partial output", () => {
    expect(() =>
      commit(
        review({
          decisions: [
            {
              decisionId: "edit-1",
              effectId: "effect-1",
              expectedVersion: 2,
              kind: "edit",
            },
          ],
        }),
      ),
    ).toThrowError(CanonicalCombatModifierReviewError);
    expect(() =>
      commitCanonicalCombatModifierReview({
        acceptedRevision: "revision-3",
        acceptedSequence: 13,
        commandId: "command-1",
        review: review(),
      }),
    ).toThrowError(/state changed/i);
  });

  it("blocks only explicitly blocking unresolved roll requirements", () => {
    const blocked = review({
      requiredRolls: [
        {
          blocksReview: true,
          id: "roll-1",
          kind: "gm_review",
          owner: "modifier_review",
          resolved: false,
        },
      ],
    });
    expect(getCanonicalCombatModifierReviewState(blocked)).toBe("blocked");
    expect(() => commit(blocked)).toThrowError(/required modifier-review roll/i);

    const suOwned = review({
      requiredRolls: [
        {
          blocksReview: false,
          id: "bleed-health-check",
          kind: "health",
          owner: "su",
          resolved: false,
          sourceEffectId: "effect-1",
        },
      ],
    });
    expect(getCanonicalCombatModifierReviewState(suOwned)).toBe("ready");
    expect(commit(suOwned).changes).toEqual([]);
  });

  it("does not allow M1/M2 to commit SU-owned transitions", () => {
    expect(() =>
      commit(
        review({
          automaticProposals: [
            {
              effectId: "effect-1",
              expectedVersion: 1,
              id: "proposal-su",
              mayOverride: false,
              nextState: "resolved",
              owner: "su",
              reason: "check_succeeded",
              transitionType: "resolve",
            },
          ],
          decisions: [
            { decisionId: "accept-su", kind: "accept_proposal", proposalId: "proposal-su" },
          ],
        }),
      ),
    ).toThrowError(/belongs to another canonical process/i);
  });
});

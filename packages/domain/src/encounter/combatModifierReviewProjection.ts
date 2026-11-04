import type {
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
  ScenarioParticipantState,
} from "../campaign/scenario";
import { combatEffectsStateSchema } from "./combatEffects";
import {
  canonicalCombatModifierEffectSchema,
  CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
  type CanonicalCombatModifierEffect,
} from "./combatModifierLifecycle";
import { adaptModifierBucketRowToCanonicalLifecycle } from "./combatModifierLifecycleCompatibility";
import {
  canonicalCombatModifierReviewInputSchema,
  commitCanonicalCombatModifierReview,
  CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
  type CanonicalCombatModifierReviewDecision,
  type CanonicalCombatModifierReviewInput,
  type CanonicalCombatModifierReviewProposal,
  type CanonicalCombatModifierReviewTransaction,
} from "./combatModifierReview";

const MODIFIER_REVIEW_BUCKETS = [
  ["general", "general"],
  ["situationInitiative", "initiative"],
  ["situationObSkill", "skill_ob"],
  ["situationDb", "db_parry"],
] as const;

const MODIFIER_REVIEW_LEGACY_BUCKETS = {
  general: "general",
  situationDb: "situation_db",
  situationInitiative: "situation_initiative",
  situationObSkill: "situation_ob_skill",
} as const;

function modifierReviewRows(context: ScenarioParticipantCombatContext): Array<{
  bucketKey: (typeof MODIFIER_REVIEW_BUCKETS)[number][0];
  category: (typeof MODIFIER_REVIEW_BUCKETS)[number][1];
  entry: ScenarioCombatModifierEntry;
}> {
  return MODIFIER_REVIEW_BUCKETS.flatMap(([bucketKey, category]) =>
    context.modifierBuckets[bucketKey].map((entry) => ({ bucketKey, category, entry })),
  );
}

function participantOwnedModifierReviewRows(input: {
  context: ScenarioParticipantCombatContext;
  participantId: string;
}) {
  return modifierReviewRows(input.context).filter(({ entry }) => {
    const lifecycle = canonicalCombatModifierEffectSchema.safeParse(entry.canonicalLifecycle);
    return !lifecycle.success || lifecycle.data.ownerParticipantId === input.participantId;
  });
}

function modifierReviewEffectId(
  entry: ScenarioCombatModifierEntry,
  knownEffectIds?: { has(value: string): boolean },
): string {
  const lifecycle = canonicalCombatModifierEffectSchema.safeParse(entry.canonicalLifecycle);
  if (lifecycle.success) return lifecycle.data.id;
  return entry.sourceEffectId && knownEffectIds?.has(entry.sourceEffectId)
    ? entry.sourceEffectId
    : entry.id;
}

/**
 * The single producer of modifier-review durations.
 *
 * `origin: "authored"` is a duration the GM is entering now — a new `add` row, or an `edit` that
 * changes the duration. Such a row carries no `phase` applicability, so it is round-clock scoped
 * and must use the canonical round vocabulary: the remainder of the creation round plus
 * `remaining` full subsequent rounds. That is the same semantics the damage and Combat Experience
 * producers emit, so "-10%, 2 rounds" entered in round 7 covers rounds 7-9 whichever path it
 * arrives through.
 *
 * `origin: "legacy_adaptation"` feeds the compatibility adapter's `explicitDuration` and emits the
 * same `creationRoundCounts: true` encoding that the adapter's own round-clock arm emits
 * (`combatModifierLifecycleCompatibility.ts`, `durationForBucketRow`). That encoding is NOT reached
 * only by reconstruction of already-persisted rows. Two distinct classes of row land on it:
 *
 * - Reconstruction of a stored modifier-bucket row that carries no canonical lifecycle. Only the
 *   lifetime arithmetic is preserved — the row's own round is counted against `remaining`. The
 *   `startRound` stamped here is `input.roundNumber`, the round the reconstruction is running in,
 *   not the round the row was originally stored in.
 * - Newly built generated rows. The `parry` and `offensive_parry` declaration modifiers are built
 *   during combat declaration by `combatActionModifiers.ts` and passed through
 *   `attachCanonicalLifecycleToModifierBucketRow`. They carry `durationRounds: 1`, no `sourcePhase`,
 *   and `sourceRoundNumber` set to the current round, so they reach the adapter's round-clock arm
 *   and are stamped with the current round. A parry declared in round 7 yields
 *   `{ startRound: 7, creationRoundCounts: true, remaining: 1 }` and expires at round 7's own
 *   Round End.
 *
 * So `creationRoundCounts: true` states only how the lifetime is counted; it does not mean the
 * stamped `startRound` is historical. Whether the generated declaration rows should keep this
 * encoding or move to S4's `remainder_of_round` is an open scoping question held by the control
 * plane (#459). Changing `creationRoundCounts` to `false` for them would add a full round to their
 * lifetime; `combatModifierLifecycleCompatibility.test.ts` pins the current behaviour.
 */
function modifierReviewDuration(input: {
  canonicalCutoff: number;
  durationRounds?: number;
  origin: "authored" | "legacy_adaptation";
  phase: "M1" | "M2";
  roundNumber: number;
}) {
  return input.durationRounds
    ? {
        creationRoundCounts: input.origin === "legacy_adaptation",
        kind: "rounds" as const,
        remaining: input.durationRounds,
        startPhase: input.phase === "M1" ? ("phase1" as const) : ("phase2" as const),
        startRound: input.roundNumber,
        startSequence: input.canonicalCutoff,
        transitionBoundary: "round_boundary" as const,
      }
    : {
        kind: "manual" as const,
        removableBy: "gm" as const,
        startPhase: input.phase === "M1" ? ("phase1" as const) : ("phase2" as const),
        startRound: input.roundNumber,
        startSequence: input.canonicalCutoff,
      };
}

function buildManualModifierReviewEffect(input: {
  canonicalCutoff: number;
  category: "general" | "initiative" | "skill_ob" | "db_parry";
  createdAt: string;
  encounterId: string;
  entry: ScenarioCombatModifierEntry;
  ownerParticipantId: string;
  phase: "M1" | "M2";
  revision: string;
  roundNumber: number;
}): CanonicalCombatModifierEffect {
  if (input.entry.application === "flat_db") {
    throw new RangeError(
      "New GM modifiers use percentage application unless an authoritative direct-point rule exists.",
    );
  }
  const category =
    input.category === "general"
      ? "general_fatigue"
      : input.category === "initiative"
        ? "initiative"
        : input.category;
  return canonicalCombatModifierEffectSchema.parse({
    applicability: {
      combatWide: true,
      encounterId: input.encounterId,
      rollPurposes: [],
      roundNumber: input.roundNumber,
    },
    createdAt: input.createdAt,
    createdRevision: input.revision,
    createdSequence: input.canonicalCutoff,
    id: input.entry.id,
    lifecycle: {
      duration: modifierReviewDuration({
        canonicalCutoff: input.canonicalCutoff,
        durationRounds: input.entry.durationRounds,
        origin: "authored",
        phase: input.phase,
        roundNumber: input.roundNumber,
      }),
      state: "active",
    },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: input.ownerParticipantId,
    payload: {
      category,
      contributionScope: "calculation",
      kind: "numeric",
      unit: input.category === "initiative" ? "initiative_value" : "percentage",
      value: input.entry.value,
    },
    provenanceCompleteness: "complete",
    publicLabel: input.entry.notes?.trim() || "GM modifier",
    schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    sourceFamily: "manual",
    sourceReferences: { rowId: input.entry.id },
    version: 1,
    visibility: { audience: "public", sourceIdentity: "public" },
  });
}

export interface CanonicalCombatModifierReviewProjectionInput {
  readonly canonicalCutoff: number;
  readonly commandId: string;
  readonly createdAt: string;
  readonly currentContext: ScenarioParticipantCombatContext;
  readonly draftContext: ScenarioParticipantCombatContext;
  readonly encounterId: string;
  readonly participantState: ScenarioParticipantState;
  readonly phase: "M1" | "M2";
  readonly publicNote?: string;
  readonly revision: string;
  readonly roundNumber: number;
  /** Durable lifecycle-effect owner, not the encounter-combatant process identity. */
  readonly scenarioParticipantId: string;
}

/**
 * Projects the immutable participant-owned input used by descriptor creation, draft initialization,
 * participation classification, and commit validation. Contextual foreign rows are deliberately
 * excluded from the mutation transaction.
 */
export function projectCanonicalCombatModifierReviewInput(
  input: CanonicalCombatModifierReviewProjectionInput,
): CanonicalCombatModifierReviewInput {
  const inputEffects = new Map<string, CanonicalCombatModifierEffect>();
  for (const effect of combatEffectsStateSchema.parse(input.participantState.combatEffects)
    .effects) {
    if (effect.canonicalLifecycle?.ownerParticipantId === input.scenarioParticipantId) {
      inputEffects.set(effect.canonicalLifecycle.id, effect.canonicalLifecycle);
    }
  }
  for (const { bucketKey, entry } of participantOwnedModifierReviewRows({
    context: input.currentContext,
    participantId: input.scenarioParticipantId,
  })) {
    const lifecycle = canonicalCombatModifierEffectSchema.safeParse(entry.canonicalLifecycle);
    const adapted = lifecycle.success
      ? lifecycle.data
      : adaptModifierBucketRowToCanonicalLifecycle({
          bucket: MODIFIER_REVIEW_LEGACY_BUCKETS[bucketKey],
          context: {
            createdAt: input.createdAt,
            createdRevision: input.revision,
            createdSequence: input.canonicalCutoff,
            encounterId: input.encounterId,
            explicitDuration:
              entry.durationRounds === undefined
                ? undefined
                : modifierReviewDuration({
                    canonicalCutoff: input.canonicalCutoff,
                    durationRounds: entry.durationRounds,
                    origin: "legacy_adaptation",
                    phase: input.phase,
                    roundNumber: input.roundNumber,
                  }),
            explicitUnit: entry.application,
            visibility: { audience: "public", sourceIdentity: "public" },
          },
          entry,
          ownerParticipantId: input.scenarioParticipantId,
        }).effect;
    if (adapted) inputEffects.set(adapted.id, adapted);
  }

  const currentRows = new Map(
    participantOwnedModifierReviewRows({
      context: input.currentContext,
      participantId: input.scenarioParticipantId,
    }).map((row) => [modifierReviewEffectId(row.entry, inputEffects), row]),
  );
  const draftRows = new Map(
    participantOwnedModifierReviewRows({
      context: input.draftContext,
      participantId: input.scenarioParticipantId,
    }).map((row) => [modifierReviewEffectId(row.entry, inputEffects), row]),
  );
  const proposals: CanonicalCombatModifierReviewProposal[] = [];
  for (const effect of inputEffects.values()) {
    if (
      effect.lifecycle.state !== "active" ||
      effect.lifecycle.duration.kind !== "phase" ||
      effect.lifecycle.duration.phase === (input.phase === "M1" ? "phase1" : "phase2") ||
      (draftRows.has(effect.id) && effect.sourceFamily !== "manual")
    ) {
      continue;
    }
    proposals.push({
      effectId: effect.id,
      expectedVersion: effect.version,
      id: `${input.commandId}:proposal:expire:${effect.id}`,
      mayOverride: effect.sourceFamily === "manual",
      nextState: "expired",
      owner: "modifier_review",
      reason: "natural_expiry",
      transitionType: "expire",
    });
  }

  const proposalByEffectId = new Map(proposals.map((proposal) => [proposal.effectId, proposal]));
  const decisions: CanonicalCombatModifierReviewDecision[] = [];
  for (const [effectId, current] of currentRows) {
    const effect = inputEffects.get(effectId);
    if (!effect) continue;
    const draft = draftRows.get(effectId);
    const proposal = proposalByEffectId.get(effectId);
    if (!draft) {
      decisions.push(
        proposal
          ? {
              decisionId: `${input.commandId}:accept:${proposal.id}`,
              kind: "accept_proposal",
              proposalId: proposal.id,
            }
          : {
              decisionId: `${input.commandId}:remove:${effectId}`,
              effectId,
              expectedVersion: effect.version,
              kind: "remove",
            },
      );
      continue;
    }
    if (proposal) {
      decisions.push({
        decisionId: `${input.commandId}:retain:${proposal.id}`,
        kind: "retain",
        proposalId: proposal.id,
      });
    }
    const valueChanged =
      effect.payload.kind === "numeric" && effect.payload.value !== draft.entry.value;
    const durationChanged = current.entry.durationRounds !== draft.entry.durationRounds;
    const labelChanged =
      Boolean(draft.entry.notes?.trim()) && draft.entry.notes?.trim() !== effect.publicLabel;
    if (valueChanged || durationChanged || labelChanged) {
      // No `sourceFamily` allow-list. The app tracks modifiers and the GM modifies them (#915
      // comment 20281, ruling 2: "The present should always show what the situation is, and should
      // at many points be available for the GM to change"), so a GM edit is accepted on every
      // family, generated ones included. Until #898 this threw a `RangeError` for the ten families
      // outside a six-entry allow-list — which covered every family a GM meets at an ordinary
      // declaration review — and because the throw escaped while the decision list was still being
      // built, one such row aborted the whole review commit and lost every unrelated edit with it.
      //
      // The structural refusals in `commitCanonicalCombatModifierReview` are unaffected and still
      // reject the whole transaction: a changed payload kind, category or unit needs replacement
      // rather than an edit, and a stale `expectedVersion` means the review is no longer current.
      // Those are integrity failures of the submitted transaction, not GM decisions about a value.
      decisions.push({
        decisionId: `${input.commandId}:edit:${effectId}`,
        effectId,
        expectedVersion: effect.version,
        kind: "edit",
        nextDuration: durationChanged
          ? modifierReviewDuration({
              canonicalCutoff: input.canonicalCutoff,
              durationRounds: draft.entry.durationRounds,
              origin: "authored",
              phase: input.phase,
              roundNumber: input.roundNumber,
            })
          : undefined,
        nextPayload:
          valueChanged && effect.payload.kind === "numeric"
            ? { ...effect.payload, value: draft.entry.value }
            : undefined,
        nextPublicLabel: labelChanged ? draft.entry.notes?.trim() : undefined,
      });
    }
  }
  for (const [effectId, draft] of draftRows) {
    if (currentRows.has(effectId) || inputEffects.has(effectId)) continue;
    decisions.push({
      decisionId: `${input.commandId}:add:${effectId}`,
      effect: buildManualModifierReviewEffect({
        canonicalCutoff: input.canonicalCutoff,
        category: draft.category,
        createdAt: input.createdAt,
        encounterId: input.encounterId,
        entry: draft.entry,
        ownerParticipantId: input.scenarioParticipantId,
        phase: input.phase,
        revision: input.revision,
        roundNumber: input.roundNumber,
      }),
      kind: "add",
    });
  }

  const requiredRolls = [...inputEffects.values()].flatMap((effect) => {
    const duration = effect.lifecycle.duration;
    if (duration.kind !== "until_check") return [];
    const owner =
      duration.check.checkKind === "gm_review" ? ("modifier_review" as const) : ("su" as const);
    return [
      {
        blocksReview: owner === "modifier_review",
        id: duration.check.checkId,
        kind: duration.check.checkKind,
        owner,
        resolved: effect.lifecycle.state === "resolved",
        sourceEffectId: effect.id,
      },
    ];
  });

  return canonicalCombatModifierReviewInputSchema.parse({
    automaticProposals: proposals,
    canonicalCutoff: input.canonicalCutoff,
    decisions,
    encounterId: input.encounterId,
    expectedEncounterRevision: input.revision,
    inputEffects: [...inputEffects.values()],
    participantId: input.scenarioParticipantId,
    phase: input.phase,
    publicNote: input.publicNote,
    requiredRolls,
    reviewId: `${input.commandId}:review`,
    roundNumber: input.roundNumber,
    schemaVersion: CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
  });
}

export function buildCanonicalCombatModifierReviewFromDraft(
  input: CanonicalCombatModifierReviewProjectionInput,
): CanonicalCombatModifierReviewTransaction {
  return commitCanonicalCombatModifierReview({
    acceptedRevision: input.revision,
    acceptedSequence: input.canonicalCutoff,
    commandId: input.commandId,
    review: projectCanonicalCombatModifierReviewInput(input),
  });
}

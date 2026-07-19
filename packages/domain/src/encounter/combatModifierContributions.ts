import type {
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
} from "../campaign/scenario";
import type { CombatRoundStep } from "./combatRoundManager";

/**
 * Normalized combat modifier contributions are an adapter over the current persisted
 * effect, bucket, proposal, and roll facts. They are not a replacement source of truth.
 * Source systems remain authoritative; future calculations can resolve these contributions
 * with a complete owner/opponent/pair/action/roll context and record the applied facts.
 */
export type CombatModifierSourceKind =
  | "persistent_effect"
  | "gm_situational"
  | "action_generated"
  | "roll_adjustment"
  | "system_derived";

export type CombatModifierEditPolicy =
  | "source_only"
  | "gm_editable"
  | "gm_override"
  | "system_only";

export type CombatModifierLifetimeKind =
  | "persistent"
  | "scenario"
  | "encounter"
  | "round"
  | "phase"
  | "action"
  | "roll"
  | "until_removed"
  | "until_save";

export type CombatModifierContributionStatus =
  | "pending"
  | "active"
  | "expired"
  | "resolved"
  | "removed";

export type CombatModifierContributionBucket =
  | "general_fatigue"
  | "initiative"
  | "skill_ob"
  | "db_parry";

export interface CombatModifierApplicability {
  participantId?: string;
  opponentParticipantId?: string;
  pairKey?: string;

  phase?: "phase1" | "phase2";
  step?: CombatRoundStep;

  actionId?: string;
  opportunityId?: string;
  proposalId?: string;

  rollType?: string;
  skillId?: string;
  skillGroupId?: string;

  activatesAfterSequence?: number;
  simultaneousGroupId?: string;
}

export interface CombatModifierLifetime {
  kind: CombatModifierLifetimeKind;
  status: CombatModifierContributionStatus;

  sourceRoundNumber?: number;
  expiresAtRound?: number;
  expiresAfterPhase?: "phase1" | "phase2";
}

export interface CombatModifierContribution {
  id: string;
  schemaVersion: number;

  ownerParticipantId: string;

  sourceKind: CombatModifierSourceKind;
  sourceId: string;

  sourceEncounterId?: string;
  sourceRoundNumber?: number;
  sourceCommandId?: string;
  sourceProposalId?: string;
  sourceAttackResultId?: string;

  bucket: CombatModifierContributionBucket;

  value: number;
  label: string;
  notes?: string;

  applicability: CombatModifierApplicability;
  lifetime: CombatModifierLifetime;

  editPolicy: CombatModifierEditPolicy;
  readOnly: boolean;
}

/**
 * The calculation context is the complete identity available when a modifier bucket is
 * resolved.  It deliberately carries more scope than any one calculation needs so the same
 * applicability contract can be reused by initiative, attacks, contests, and later rolls.
 */
export interface CombatCalculationContext {
  encounterId?: string;
  roundNumber?: number;

  ownerParticipantId: string;
  opponentParticipantId?: string;
  pairKey?: string;

  phase?: "phase1" | "phase2";
  step?: CombatRoundStep;

  actionId?: string;
  opportunityId?: string;
  proposalId?: string;

  rollType?: string;
  skillId?: string;
  skillGroupId?: string;

  initiativeSequence?: number;
  simultaneousGroupId?: string;
}

/** Backward-compatible name used by the Slice 1 applicability helpers. */
export type CombatModifierResolutionContext = CombatCalculationContext;

export interface CombatModifierResolution {
  bucket: CombatModifierContributionBucket;
  total: number;
  rows: CombatModifierContribution[];
}

export interface NormalizeScenarioCombatModifierEntryInput {
  entry: ScenarioCombatModifierEntry;
  bucket: ScenarioCombatModifierBucket;
  ownerParticipantId: string;
  currentRound?: number;
  applicability?: CombatModifierApplicability;
}

const PHASE_ORDER = { phase1: 1, phase2: 2 } as const;

/**
 * Creates the canonical unordered identity for a symmetric participant pair.
 * This is intentionally shared with distance state rather than rebuilding pair strings in
 * modifier consumers.
 */
export function createCombatParticipantPairKey(
  participantAId: string,
  participantBId: string,
): string {
  const participantA = participantAId.trim();
  const participantB = participantBId.trim();

  if (!participantA || !participantB) {
    throw new RangeError("A participant pair requires two participant ids.");
  }

  if (participantA === participantB) {
    throw new RangeError("A participant pair requires two distinct participants.");
  }

  return [participantA, participantB].sort((left, right) => left.localeCompare(right)).join("::");
}

function mapBucket(bucket: ScenarioCombatModifierBucket): CombatModifierContributionBucket {
  switch (bucket) {
    case "general":
      return "general_fatigue";
    case "situation_initiative":
      return "initiative";
    case "situation_ob_skill":
      return "skill_ob";
    case "situation_db":
      return "db_parry";
  }
}

function isFeintEntry(entry: ScenarioCombatModifierEntry): boolean {
  return (
    entry.sourceType === "feint" ||
    entry.id.startsWith("generated:feint:") ||
    entry.sourceRule?.startsWith("feint:") === true
  );
}

function inferSourceKind(entry: ScenarioCombatModifierEntry): CombatModifierSourceKind {
  if (entry.imported || entry.sourceType === "character_effect" || entry.sourceEffectId) {
    return "persistent_effect";
  }

  if (
    entry.generated ||
    isFeintEntry(entry) ||
    entry.sourceActionId ||
    entry.sourceProposalId ||
    entry.sourceRule
  ) {
    return "action_generated";
  }

  // Legacy rows have no reliable provenance. Treat them as editable situational rows without
  // inventing a narrower participant, opponent, pair, or action scope.
  return "gm_situational";
}

function inferLifetimeKind(
  entry: ScenarioCombatModifierEntry,
  sourceKind: CombatModifierSourceKind,
): CombatModifierLifetimeKind {
  if (sourceKind === "persistent_effect") return "persistent";
  if (entry.persistsAcrossEncounters) return "scenario";
  if (entry.sourcePhase || entry.sourceActionId || entry.sourceProposalId) return "action";
  if (entry.sourceEncounterId) return "encounter";
  return "encounter";
}

function inferEditPolicy(
  entry: ScenarioCombatModifierEntry,
  sourceKind: CombatModifierSourceKind,
  readOnly: boolean,
): CombatModifierEditPolicy {
  if (sourceKind === "persistent_effect") return "source_only";
  if (readOnly) return "system_only";
  if (sourceKind === "action_generated") return "gm_override";
  return "gm_editable";
}

function inferApplicability(entry: ScenarioCombatModifierEntry): CombatModifierApplicability {
  return {
    actionId: entry.sourceActionId,
    phase: entry.sourcePhase,
    proposalId: entry.sourceProposalId,
  };
}

/**
 * Adapts one existing bucket row without writing anything back to persisted state.
 * Existing row IDs are retained so repeated projections remain deterministic.
 */
export function normalizeScenarioCombatModifierEntry(
  input: NormalizeScenarioCombatModifierEntryInput,
): CombatModifierContribution | undefined {
  if (!Number.isFinite(input.entry.value)) return undefined;

  const sourceKind = inferSourceKind(input.entry);
  const readOnly = input.entry.readOnly ?? sourceKind === "persistent_effect";
  const status: CombatModifierContributionStatus =
    input.currentRound !== undefined &&
    input.entry.expiresAtRound !== undefined &&
    input.entry.expiresAtRound < input.currentRound
      ? "expired"
      : "active";
  const inferredApplicability = inferApplicability(input.entry);
  const applicability = {
    ...inferredApplicability,
    ...input.applicability,
  };
  const lifetimeKind = inferLifetimeKind(input.entry, sourceKind);

  return {
    id: input.entry.id,
    schemaVersion: 1,
    ownerParticipantId: input.ownerParticipantId,
    sourceKind,
    sourceId: input.entry.sourceEffectId ?? input.entry.sourceProposalId ?? input.entry.id,
    sourceEncounterId: input.entry.sourceEncounterId,
    sourceRoundNumber: input.entry.sourceRoundNumber,
    sourceProposalId: input.entry.sourceProposalId,
    bucket: mapBucket(input.bucket),
    value: input.entry.value,
    label:
      input.entry.notes?.trim() ||
      input.entry.sourceRule?.trim() ||
      input.entry.sourceActionId?.trim() ||
      "Combat modifier",
    notes: input.entry.notes,
    applicability,
    lifetime: {
      kind: lifetimeKind,
      status,
      sourceRoundNumber: input.entry.sourceRoundNumber,
      expiresAtRound: input.entry.expiresAtRound,
    },
    editPolicy: inferEditPolicy(input.entry, sourceKind, readOnly),
    readOnly,
  };
}

function isPhaseAfter(
  phase: "phase1" | "phase2",
  expiresAfterPhase: "phase1" | "phase2",
): boolean {
  return PHASE_ORDER[phase] > PHASE_ORDER[expiresAfterPhase];
}

function doesLifetimeApply(
  contribution: CombatModifierContribution,
  context: CombatModifierResolutionContext,
): boolean {
  const { lifetime } = contribution;

  if (
    contribution.sourceEncounterId &&
    context.encounterId !== undefined &&
    contribution.sourceEncounterId !== context.encounterId
  ) {
    return false;
  }

  if (lifetime.expiresAtRound !== undefined) {
    if (context.roundNumber === undefined || context.roundNumber > lifetime.expiresAtRound) {
      return false;
    }
  }

  if (
    lifetime.sourceRoundNumber !== undefined &&
    ["round", "phase", "action", "roll"].includes(lifetime.kind) &&
    context.roundNumber !== undefined &&
    context.roundNumber !== lifetime.sourceRoundNumber
  ) {
    return false;
  }

  if (lifetime.expiresAfterPhase !== undefined) {
    if (context.phase === undefined || isPhaseAfter(context.phase, lifetime.expiresAfterPhase)) {
      return false;
    }
  }

  return true;
}

function matchesDimension(expected: string | undefined, actual: string | undefined): boolean {
  return expected === undefined || expected === actual;
}

/** Returns true for active, finite contributions before context-specific filtering. */
export function isCombatModifierContributionActive(
  contribution: CombatModifierContribution,
  context?: CombatModifierResolutionContext,
): boolean {
  return (
    contribution.lifetime.status === "active" &&
    Number.isFinite(contribution.value) &&
    (context === undefined || doesLifetimeApply(contribution, context))
  );
}

/**
 * Applies only explicitly known applicability dimensions. Missing fields mean that dimension is
 * not narrowed; a narrowed dimension requires the matching context value.
 */
export function doesCombatModifierContributionApply(
  contribution: CombatModifierContribution,
  context: CombatModifierResolutionContext,
): boolean {
  if (
    !context.ownerParticipantId ||
    contribution.ownerParticipantId !== context.ownerParticipantId ||
    !isCombatModifierContributionActive(contribution, context)
  ) {
    return false;
  }

  const applicability = contribution.applicability;

  if (!matchesDimension(applicability.participantId, context.ownerParticipantId)) return false;
  if (!matchesDimension(applicability.opponentParticipantId, context.opponentParticipantId)) {
    return false;
  }
  if (!matchesDimension(applicability.pairKey, context.pairKey)) return false;
  if (!matchesDimension(applicability.phase, context.phase)) return false;
  if (!matchesDimension(applicability.step, context.step)) return false;
  if (!matchesDimension(applicability.actionId, context.actionId)) return false;
  if (!matchesDimension(applicability.opportunityId, context.opportunityId)) return false;
  if (!matchesDimension(applicability.proposalId, context.proposalId)) return false;
  if (!matchesDimension(applicability.rollType, context.rollType)) return false;
  if (!matchesDimension(applicability.skillId, context.skillId)) return false;
  if (!matchesDimension(applicability.skillGroupId, context.skillGroupId)) return false;

  if (applicability.activatesAfterSequence !== undefined) {
    if (
      context.initiativeSequence === undefined ||
      context.initiativeSequence <= applicability.activatesAfterSequence
    ) {
      return false;
    }
  }

  if (
    applicability.simultaneousGroupId !== undefined &&
    applicability.simultaneousGroupId === context.simultaneousGroupId
  ) {
    return false;
  }

  return true;
}

export function filterApplicableCombatModifierContributions(
  contributions: readonly CombatModifierContribution[],
  context: CombatCalculationContext,
): CombatModifierContribution[] {
  return contributions.filter((contribution) =>
    doesCombatModifierContributionApply(contribution, context),
  );
}

/**
 * Resolves one normalized bucket for a calculation without consulting any legacy source rows.
 * Filtering preserves the normalized source order, making the contributing facts deterministic
 * and suitable for a later calculation/history record.
 */
export function resolveCombatModifierContributions(input: {
  bucket: CombatModifierContributionBucket;
  context: CombatCalculationContext;
  contributions: readonly CombatModifierContribution[];
}): CombatModifierResolution {
  const rows = filterApplicableCombatModifierContributions(input.contributions, input.context).filter(
    (contribution) => contribution.bucket === input.bucket,
  );

  return {
    bucket: input.bucket,
    rows,
    total: sumCombatModifierContributions(rows),
  };
}

export function sumCombatModifierContributions(
  contributions: readonly CombatModifierContribution[],
): number {
  return contributions.reduce(
    (total, contribution) =>
      Number.isFinite(contribution.value) ? total + contribution.value : total,
    0,
  );
}

export function reduceCombatModifierContributionsByBucket(
  contributions: readonly CombatModifierContribution[],
): Record<CombatModifierContributionBucket, number> {
  const totals: Record<CombatModifierContributionBucket, number> = {
    db_parry: 0,
    general_fatigue: 0,
    initiative: 0,
    skill_ob: 0,
  };

  for (const contribution of contributions) {
    if (Number.isFinite(contribution.value)) {
      totals[contribution.bucket] += contribution.value;
    }
  }

  return totals;
}

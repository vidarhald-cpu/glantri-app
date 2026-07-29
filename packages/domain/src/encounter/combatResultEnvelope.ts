import { z } from "zod";

import {
  buildCombatResultAdjustmentMetadata,
  combatResultAdjustmentMetadataSchema,
  combatResultCalculationReferenceSchema,
  combatResultConsequenceSchema,
  combatResultPrivateDiagnosticSchema,
  type CombatResultConsequence,
} from "./combatResultPresentation";
import {
  combatStepEventCompletenessSchema,
  combatStepEventIdentityRoleSchema,
  combatStepEventOutcomeScopeSchema,
  combatStepEventSourceKindSchema,
  combatStepEventStepSchema,
  combatStepEventTypeSchema,
  type CombatStepEvent,
} from "./combatStepEventSchema";

const idSchema = z.string().min(1);

export const combatResultParticipantSchema = z
  .object({
    displayName: z.string().min(1),
    participantId: idSchema.optional(),
    role: z.union([combatStepEventIdentityRoleSchema, z.literal("owner")]),
    visibility: z.enum(["visible", "unseen"]),
  })
  .strict();
export type CombatResultParticipant = z.infer<typeof combatResultParticipantSchema>;

export const combatResultEnvelopeSchema = z
  .object({
    actionInstanceId: idSchema.optional(),
    actionType: combatStepEventTypeSchema,
    actor: combatResultParticipantSchema.optional(),
    adjustment: combatResultAdjustmentMetadataSchema.optional(),
    affectedParticipants: z.array(combatResultParticipantSchema).default([]),
    calculationReferences: z.array(combatResultCalculationReferenceSchema).default([]),
    committedConsequences: z.array(combatResultConsequenceSchema).default([]),
    conciseOutcome: z
      .object({
        details: z.array(z.string().min(1)).default([]),
        label: z.string().min(1),
      })
      .strict(),
    privateDiagnostics: z.array(combatResultPrivateDiagnosticSchema).default([]),
    participants: z.array(combatResultParticipantSchema).default([]),
    provenance: z
      .object({
        commandId: idSchema.optional(),
        completeness: combatStepEventCompletenessSchema,
        occurredAt: z.string().datetime().nullable(),
        sourceIds: z.array(idSchema).default([]),
        sourceKind: combatStepEventSourceKindSchema,
      })
      .strict(),
    publicCombatNote: z.string().min(1).optional(),
    resultId: idSchema,
    round: z.number().int().positive(),
    schemaVersion: z.literal(1),
    sequence: z.number().int().nonnegative(),
    standardConsequences: z.array(combatResultConsequenceSchema).default([]),
    step: combatStepEventStepSchema,
    subordinateEventReferences: z.array(idSchema).default([]),
    targets: z.array(combatResultParticipantSchema).default([]),
    visibility: z
      .object({
        calculationAccess: z.enum(["full", "none", "own"]),
        outcomeScope: combatStepEventOutcomeScopeSchema,
        privateDiagnosticsIncluded: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type CombatResultEnvelope = z.infer<typeof combatResultEnvelopeSchema>;

interface ProjectedIdentity {
  displayName: string;
  participantId?: string;
  role: CombatResultParticipant["role"];
  visibility: CombatResultParticipant["visibility"];
}

function humanizeEventType(type: CombatStepEvent["type"]): string {
  return type.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function firstIdentity(
  identities: readonly ProjectedIdentity[],
  roles: readonly ProjectedIdentity["role"][],
): ProjectedIdentity | undefined {
  for (const role of roles) {
    const identity = identities.find((candidate) => candidate.role === role);
    if (identity) return identity;
  }
  return undefined;
}

function safeConsequences(
  consequences: readonly CombatResultConsequence[],
  visibleParticipantIds: ReadonlySet<string>,
): CombatResultConsequence[] {
  return consequences.filter(
    (consequence) =>
      !consequence.affectedParticipantId ||
      visibleParticipantIds.has(consequence.affectedParticipantId),
  );
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function factString(event: CombatStepEvent, key: string): string | undefined {
  return (
    nonEmptyString(event.facts.involvedOutcome[key]) ??
    nonEmptyString(event.facts.publicOutcome[key])
  );
}

/**
 * Resolves an action/process identity only from explicit canonical event metadata.
 *
 * This is intentionally type-scoped. A shared actor, target, label, step, or adjacent sequence
 * is never sufficient to group two results.
 */
function canonicalActionInstanceId(event: CombatStepEvent): string | undefined {
  switch (event.type) {
    case "feint_feasibility":
    case "feint_impossible":
    case "feint_roll":
    case "feint_result":
    case "feint_committed":
    case "adjust_distance_response":
    case "adjust_distance_adjustment":
    case "adjust_distance_roll":
    case "adjust_distance_result":
    case "adjust_distance_committed":
      return factString(event, "proposalId");
    case "observation":
      return factString(event, "observationAttemptId");
    case "offensive_parry_brawling":
    case "continued_contact_maintenance":
      return factString(event, "contestId");
    case "hit_location":
    case "critical":
    case "damage_proposed":
    case "damage_committed":
      return (
        event.damageResultId ??
        (event.attackResultId ? `${event.attackResultId}:damage` : undefined)
      );
    case "attack":
    case "parry":
      return event.attackResultId ?? event.opportunityId;
    default:
      return (
        event.opportunityId ??
        event.attackResultId ??
        event.parryResultId ??
        event.damageResultId ??
        event.distanceProposalId
      );
  }
}

/**
 * Older accepted Feint and damage-review events stored player-intended commentary inside these
 * two known GM review shapes. No other GM review field is treated as public.
 */
function legacyPublicCombatNote(event: CombatStepEvent): string | undefined {
  if (event.type === "feint_committed") {
    return nonEmptyString(event.facts.gmReview.notes);
  }
  if (event.type === "damage_committed") {
    const review = event.facts.gmReview.review;
    return review && typeof review === "object" && !Array.isArray(review)
      ? nonEmptyString((review as Record<string, unknown>).notes)
      : undefined;
  }
  return undefined;
}

/**
 * Builds the stable, viewer-safe presentation envelope for one immutable combat event.
 *
 * Legacy events receive a bounded compatibility envelope with their canonical identity,
 * participants, and provenance. No missing outcome is reconstructed from mutable encounter state.
 */
export function projectCombatResultEnvelope(input: {
  event: CombatStepEvent;
  identities: readonly ProjectedIdentity[];
  involved: boolean;
  ownRoll: boolean;
  viewer: "gm" | "player";
}): CombatResultEnvelope {
  const presentation = input.event.facts.resultPresentation;
  const visibleParticipantIds = new Set(
    input.identities.flatMap((identity) =>
      identity.participantId ? [identity.participantId] : [],
    ),
  );
  const actor = firstIdentity(input.identities, ["actor", "attacker", "roller"]);
  const targets = input.identities.filter(
    (identity) => identity.role === "target" || identity.role === "defender",
  );
  const affectedParticipants = input.identities.filter(
    (identity) => identity.participantId !== actor?.participantId,
  );
  const explicitCalculationReferences = (presentation?.calculationReferences ?? []).filter(
    (reference) => {
      if (input.viewer === "gm") return true;
      if (reference.visibility === "involved") return input.involved;
      if (reference.visibility === "owner") return input.ownRoll;
      return false;
    },
  );
  const calculationReferences = [
    ...explicitCalculationReferences,
    ...(input.ownRoll && Object.keys(input.event.facts.rollerPrivate).length > 0
      ? [
          {
            kind: "roller_private" as const,
            ownerParticipantId: input.event.rollerParticipantId,
            sourceId: input.event.id,
            visibility: "owner" as const,
          },
        ]
      : []),
  ].filter(
    (reference, index, references) =>
      references.findIndex(
        (candidate) =>
          candidate.kind === reference.kind &&
          candidate.sourceId === reference.sourceId &&
          candidate.ownerParticipantId === reference.ownerParticipantId,
      ) === index,
  );
  const gmReviewKeys = Object.keys(input.event.facts.gmReview).sort();
  const privateDiagnostics =
    input.viewer === "gm"
      ? [
          ...(presentation?.privateDiagnostics ?? []),
          ...(gmReviewKeys.length
            ? [
                {
                  factKeys: gmReviewKeys,
                  id: `${input.event.id}:gm-review`,
                  label: "GM diagnostic facts",
                  source: "gm_review" as const,
                },
              ]
            : []),
        ]
      : [];
  const actionInstanceId = presentation?.actionInstanceId ?? canonicalActionInstanceId(input.event);
  const standardConsequences = safeConsequences(
    presentation?.standardConsequences ?? [],
    visibleParticipantIds,
  );
  const committedConsequences = safeConsequences(
    presentation?.committedConsequences ?? [],
    visibleParticipantIds,
  );

  return combatResultEnvelopeSchema.parse({
    actionInstanceId,
    actionType: input.event.type,
    actor,
    adjustment: presentation?.adjustment
      ? buildCombatResultAdjustmentMetadata({
          committedConsequences,
          standardConsequences,
        })
      : undefined,
    affectedParticipants,
    calculationReferences,
    committedConsequences,
    conciseOutcome: presentation?.conciseOutcome ?? {
      details: [],
      label: humanizeEventType(input.event.type),
    },
    privateDiagnostics,
    participants: input.identities,
    provenance: {
      commandId: input.viewer === "gm" ? input.event.commandId : undefined,
      completeness: input.event.completeness,
      occurredAt: input.event.occurredAt,
      sourceIds: input.viewer === "gm" ? input.event.source.sourceIds : [],
      sourceKind: input.event.source.kind,
    },
    publicCombatNote: presentation?.publicCombatNote ?? legacyPublicCombatNote(input.event),
    resultId: input.event.id,
    round: input.event.roundNumber,
    schemaVersion: 1,
    sequence: input.event.sequence,
    standardConsequences,
    step: input.event.step,
    subordinateEventReferences:
      input.viewer === "gm" ? (presentation?.subordinateEventReferences ?? []) : [],
    targets,
    visibility: {
      calculationAccess: input.viewer === "gm" ? "full" : input.ownRoll ? "own" : "none",
      outcomeScope: input.event.visibility.outcomeScope,
      privateDiagnosticsIncluded: privateDiagnostics.length > 0,
    },
  });
}

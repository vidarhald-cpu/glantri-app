import { describe, expect, it } from "vitest";

import {
  buildCanonicalCombatModifierReviewFromDraft,
  buildCombatRoundAttackRollResult,
  canonicalCombatModifierReviewTransactionSchema,
  combatRoundCommandSchema,
  combatRoundCommandTypeSchema,
  combatRoundEndDistanceProposalSchema,
  combatRoundStateSchema,
  encounterSessionSchema,
  getCombatRoundEndDistanceProposalLifecycle,
  getCombatRoundPhaseInitiativeChoice,
  getCombatRoundPhaseResolutionStatus,
  initializeCombatRoundPhaseResolutionCursor,
  initializeCombatRoundState,
  projectCanonicalCombatModifierReviewPublicResult,
  recordCombatRoundAttackResult,
  recordCombatRoundDeclaration,
  recordCombatRoundInitiative,
  recordCombatRoundParryResult,
  scenarioParticipantCombatContextSchema,
  scenarioParticipantStateSchema,
  skipCombatRoundCurrentPhaseAction,
  type CombatRoundCommand,
  type CombatRoundCommandType,
  type CombatRoundEndDistanceControlSide,
  type CombatRoundEndDistanceProposal,
  type CombatRoundState,
  type EncounterParticipant,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

import {
  buildPlayerSafeCombatRoundCommandForUser as projectPlayerCombatCommand,
  buildPlayerFacingEncounterForUser,
} from "./encounterRoutes";

/**
 * Forgejo #502, privacy hardening Tier 1 — the player command projection.
 *
 * Proof obligations covered in this file:
 *
 * - (4) byte-identical output for every command type the projection already decided by name. The
 *   reference is the baseline projection itself, copied verbatim below;
 * - (2) the fail-closed property: a type the projection does not enumerate is omitted, shown on an
 *   input the baseline passed through raw;
 * - the decision for every type that used to fall through to the raw stored command, and the
 *   actor identity (`createdByUserId`) absent by construction from every projected command;
 * - that the player's own client still derives the server's combat step from the projected log.
 */

// ===== BEGIN VERBATIM BASELINE ===================================================================
// git show d8b38b2969093aa37563b9df7dc597ca79bc0b80:apps/api/src/routes/scenarios/encounterRoutes.ts
//   | sed -n '5983,6353p'
// sha256 c7423b3a41d089d55b0241137d40686c29f2da97a3cfd28c1e905a48bf68bc6d
// Copied unmodified so the comparison below is against the exact pre-#502 behaviour.
function isPlayerControlledCombatParticipant(input: {
  controlledEncounterParticipantIds: Set<string>;
  participantId: string;
}): boolean {
  return input.controlledEncounterParticipantIds.has(input.participantId);
}

function getPlayerSafeDistanceControlSide(input: {
  controlledEncounterParticipantIds: Set<string>;
  side: CombatRoundEndDistanceControlSide;
}): CombatRoundEndDistanceControlSide {
  if (
    isPlayerControlledCombatParticipant({
      controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
      participantId: input.side.participantId,
    })
  ) {
    return input.side;
  }

  return {
    participantId: input.side.participantId,
    status: input.side.status,
  } as CombatRoundEndDistanceControlSide;
}

function buildPlayerSafeDistanceControlProposalForUser(input: {
  controlledEncounterParticipantIds: Set<string>;
  proposal: CombatRoundEndDistanceProposal;
  visibleParticipantIds: Set<string>;
}): CombatRoundEndDistanceProposal | undefined {
  const participantAControlled = isPlayerControlledCombatParticipant({
    controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
    participantId: input.proposal.participantAId,
  });
  const participantBControlled = isPlayerControlledCombatParticipant({
    controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
    participantId: input.proposal.participantBId,
  });

  if (!participantAControlled && !participantBControlled) {
    return undefined;
  }

  const opponentParticipantId = participantAControlled
    ? input.proposal.participantBId
    : input.proposal.participantAId;

  if (!input.visibleParticipantIds.has(opponentParticipantId)) {
    return undefined;
  }

  const safeProposal = {
    ...input.proposal,
    notes: undefined,
    participantA: getPlayerSafeDistanceControlSide({
      controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
      side: input.proposal.participantA,
    }),
    participantB: getPlayerSafeDistanceControlSide({
      controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
      side: input.proposal.participantB,
    }),
  } satisfies CombatRoundEndDistanceProposal;

  if (getCombatRoundEndDistanceProposalLifecycle(input.proposal) === "applied") {
    return safeProposal;
  }

  return {
    ...safeProposal,
    appliedDistance: undefined,
    gmOverrideDistance: undefined,
    outcome: "contest_pending",
    proposedDistance: undefined,
    warnings: [],
    winnerParticipantId: undefined,
  };
}

function sanitizePlayerSafeDistanceControlCommandFacts(input: {
  command: CombatRoundCommand;
  controlledEncounterParticipantIds: Set<string>;
  visibleParticipantIds: Set<string>;
}): CombatRoundCommand | undefined {
  const facts = input.command.facts;
  const nextProposal = facts.nextProposal as CombatRoundEndDistanceProposal | undefined;
  const previousProposal = facts.previousProposal as CombatRoundEndDistanceProposal | undefined;
  const proposal = nextProposal ?? previousProposal;
  const safeNextProposal = nextProposal
    ? buildPlayerSafeDistanceControlProposalForUser({
        controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
        proposal: nextProposal,
        visibleParticipantIds: input.visibleParticipantIds,
      })
    : undefined;
  const safePreviousProposal = previousProposal
    ? buildPlayerSafeDistanceControlProposalForUser({
        controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
        proposal: previousProposal,
        visibleParticipantIds: input.visibleParticipantIds,
      })
    : undefined;

  if (proposal && !safeNextProposal && !safePreviousProposal) {
    return undefined;
  }

  const rolledParticipantId =
    typeof facts.rolledParticipantId === "string" ? facts.rolledParticipantId : undefined;
  const playerRolledOwnSide =
    rolledParticipantId &&
    isPlayerControlledCombatParticipant({
      controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
      participantId: rolledParticipantId,
    });

  if (input.command.type === "roll_round_end_distance_control" && !playerRolledOwnSide) {
    return {
      ...input.command,
      facts: {
        distanceProposalId: facts.distanceProposalId,
        pairKey: facts.pairKey,
        participantAId: facts.participantAId,
        participantBId: facts.participantBId,
        rolledParticipantId,
        status: safeNextProposal?.status ?? safePreviousProposal?.status,
      },
    };
  }

  if (input.command.type === "roll_round_end_distance_control") {
    return {
      ...input.command,
      facts: {
        currentDistance: facts.currentDistance,
        distanceProposalId: facts.distanceProposalId,
        nextProposal: safeNextProposal,
        outcome: safeNextProposal?.outcome ?? "contest_pending",
        pairKey: facts.pairKey,
        participantAId: facts.participantAId,
        participantBId: facts.participantBId,
        previousProposal: safePreviousProposal,
        proposedDistance: safeNextProposal?.proposedDistance,
        rolledBy: facts.rolledBy,
        rolledParticipantFinalTotal: facts.rolledParticipantFinalTotal,
        rolledParticipantId,
        rolledParticipantRoll: facts.rolledParticipantRoll,
      },
    };
  }

  if (input.command.type === "commit_round_end_distance_control") {
    const safeProposal = safeNextProposal ?? safePreviousProposal;

    if (!safeProposal) {
      return undefined;
    }

    return {
      ...input.command,
      facts: {
        appliedDistance: facts.appliedDistance,
        distanceProposalId: facts.distanceProposalId,
        nextEdge: facts.nextEdge,
        nextProposal: safeNextProposal,
        outcome: safeProposal.outcome,
        pairKey: facts.pairKey,
        participantAId: facts.participantAId,
        participantBId: facts.participantBId,
        proposedDistance: safeProposal.proposedDistance,
      },
    };
  }

  return input.command;
}

function buildPlayerSafeCombatRoundCommandForUser(input: {
  command: CombatRoundCommand;
  controlledEncounterParticipantIds: Set<string>;
  visibleParticipantIds: Set<string>;
}): CombatRoundCommand | undefined {
  // Treatment commands retain exact before/after effect snapshots and the authenticated GM actor.
  // Players receive only the separately sanitized involved event/current-effect projection.
  if (input.command.type === "transition_critical_bleed") {
    return undefined;
  }

  // Feint command facts retain undo provenance, including both raw rolls and GM notes.
  // Player live state uses the separately sanitized proposal and projected event history.
  if (
    input.command.type === "review_feint_feasibility" ||
    input.command.type === "roll_feint" ||
    input.command.type === "commit_feint_result" ||
    input.command.type === "respond_adjust_distance" ||
    input.command.type === "review_adjust_distance_roll_adjustment" ||
    input.command.type === "roll_adjust_distance" ||
    input.command.type === "commit_adjust_distance"
  ) {
    return undefined;
  }

  // Disarm command facts are exact undo snapshots and contain both sides' private
  // roll calculations and canonical Item identities. The authoritative state keeps
  // them for retry/undo; player views use the sanitized attempt projection instead.
  if (
    input.command.type === "open_disarm" ||
    input.command.type === "roll_disarm" ||
    input.command.type === "commit_disarm"
  ) {
    return undefined;
  }

  if (
    input.command.type === "submit_phase_initiative_choice" &&
    !input.controlledEncounterParticipantIds.has(input.command.participantId)
  ) {
    return undefined;
  }

  if (input.command.type === "declare_action") {
    if (!input.controlledEncounterParticipantIds.has(input.command.participantId)) {
      return undefined;
    }
    if (
      input.command.facts.actionId === "disarm" ||
      input.command.facts.actionId === "parry_disarm" ||
      input.command.facts.disarm !== undefined ||
      input.command.facts.previousDisarmAttempts !== undefined
    ) {
      return {
        ...input.command,
        facts: {
          actionId: input.command.facts.actionId,
          status: input.command.facts.status,
          step: input.command.facts.step,
        },
      };
    }
  }

  if (
    input.command.type === "review_modifiers_phase1" ||
    input.command.type === "review_modifiers_phase2"
  ) {
    if (!input.controlledEncounterParticipantIds.has(input.command.participantId)) {
      return undefined;
    }
    const transaction = canonicalCombatModifierReviewTransactionSchema.safeParse(
      input.command.facts.modifierReview,
    );
    return {
      ...input.command,
      facts: transaction.success
        ? {
            modifierReviewPublicResult: projectCanonicalCombatModifierReviewPublicResult({
              transaction: transaction.data,
              viewer: {
                controlledParticipantIds: input.controlledEncounterParticipantIds,
                isGm: false,
                visibleParticipantIds: input.visibleParticipantIds,
              },
            }),
          }
        : {},
    };
  }

  if (
    input.command.type === "roll_combat_experience" &&
    !input.controlledEncounterParticipantIds.has(input.command.participantId)
  ) {
    return undefined;
  }

  if (input.command.type === "roll_attack") {
    if (!input.controlledEncounterParticipantIds.has(input.command.participantId)) {
      return undefined;
    }
    return {
      ...input.command,
      createdByUserId: undefined,
      facts: {
        actionId: input.command.facts.actionId,
        attackOpportunityId: input.command.facts.attackOpportunityId,
        attackResultId: input.command.facts.attackResultId,
        attackType: input.command.facts.attackType,
        phase: input.command.facts.phase,
        status: input.command.facts.status,
      },
    };
  }

  // Defense-review command facts retain exact canonical item identities, revisions,
  // GM provenance, and undo material. The defender receives the safe event projection.
  if (input.command.type === "commit_defense_review") {
    return undefined;
  }

  // Readiness commands carry exact ammunition identities/revisions, GM timing
  // adjustments, and undo snapshots. Players use their sanitized readiness row.
  if (
    input.command.type === "progress_missile_readiness" ||
    input.command.type === "interrupt_missile_readiness"
  ) {
    return undefined;
  }

  if (
    input.command.type === "roll_round_end_distance_control" ||
    input.command.type === "commit_round_end_distance_control"
  ) {
    return sanitizePlayerSafeDistanceControlCommandFacts(input);
  }

  if (input.command.type === "roll_continued_contact_maintenance") {
    const contactId =
      typeof input.command.facts.continuedContactId === "string"
        ? input.command.facts.continuedContactId
        : undefined;
    const contact = contactId ? input.command.facts.previousContinuedContact : undefined;
    const parsedContact =
      contact && typeof contact === "object"
        ? (contact as {
            affectedParticipantId?: unknown;
            controllerParticipantId?: unknown;
          })
        : undefined;
    const involved = [
      parsedContact?.affectedParticipantId,
      parsedContact?.controllerParticipantId,
    ].some(
      (participantId) =>
        typeof participantId === "string" &&
        (input.controlledEncounterParticipantIds.has(participantId) ||
          input.visibleParticipantIds.has(participantId)),
    );
    if (!involved) return undefined;
    return {
      ...input.command,
      facts: {
        contactMaintained: input.command.facts.contactMaintained,
        contestId: input.command.facts.contestId,
        continuedContactId: input.command.facts.continuedContactId,
        opponentParticipantId: input.command.facts.opponentParticipantId,
        resolved: input.command.facts.resolved,
        resultId: input.command.facts.resultId,
        rollId: input.command.facts.rollId,
        rollPurpose: input.command.facts.rollPurpose,
        unbalancedConditionId: input.command.facts.unbalancedConditionId,
      },
    };
  }

  if (input.command.type === "roll_observation") {
    if (!input.controlledEncounterParticipantIds.has(input.command.participantId)) {
      return undefined;
    }
    return {
      ...input.command,
      facts: {
        observationAttemptId: input.command.facts.observationAttemptId,
        relationshipId: input.command.facts.relationshipId,
        targetParticipantId: input.command.facts.targetParticipantId,
      },
    };
  }

  return input.command;
}
// ===== END VERBATIM BASELINE =====================================================================

const CONTROLLED = "hero";
const VISIBLE = "guard";
const HIDDEN = "shadow";
const ROUND = 3;

const scope = {
  controlledEncounterParticipantIds: new Set([CONTROLLED]),
  visibleParticipantIds: new Set([CONTROLLED, VISIBLE]),
};

/** Private material every fixture command carries, whatever its type. */
const PRIVATE_FACTS = {
  canonicalLifecycle: { privateDiagnostic: { code: "SECRET_LIFECYCLE_DIAGNOSTIC" } },
  canonicalSuReview: { requirements: [{ privateDiagnostic: "SECRET_SU_REVIEW" }] },
  canonicalTransitions: [
    {
      gmOverride: { reasonCode: "SECRET_GM_OVERRIDE", userId: "SECRET_GM_USER" },
      privateDiagnostic: { code: "SECRET_TRANSITION_DIAGNOSTIC" },
    },
  ],
  notes: "SECRET_GM_NOTES",
  previousStepSnapshots: [{ id: "SECRET_STEP_SNAPSHOT" }],
  reason: "SECRET_GM_REASON",
  updatedEffects: [
    { nextEffect: { id: "SECRET_NEXT_EFFECT" }, previousEffect: { id: "SECRET_PREVIOUS_EFFECT" } },
  ],
};

const NAMED_PRIVATE_KEYS = [
  "canonicalTransitions",
  "canonicalLifecycle",
  "gmOverride",
  "privateDiagnostic",
  "createdByUserId",
  "nextEffect",
  "previousEffect",
];

function makeCommand(input: {
  afterParticipantId?: string;
  beforeParticipantId?: string;
  facts?: Record<string, unknown>;
  participantId?: string;
  type: CombatRoundCommandType;
}): CombatRoundCommand {
  const participantId = input.participantId ?? CONTROLLED;
  return combatRoundCommandSchema.parse({
    afterCursor: {
      participantId: input.afterParticipantId ?? participantId,
      roundNumber: ROUND,
      step: "A1",
    },
    beforeCursor: {
      participantId: input.beforeParticipantId ?? participantId,
      roundNumber: ROUND,
      step: "A1",
    },
    createdAt: "2026-10-04T10:00:00.000Z",
    createdByUserId: "SECRET_ACTOR_USER",
    facts: { ...PRIVATE_FACTS, ...input.facts },
    id: `command:${input.type}:${participantId}`,
    participantId,
    phase: "phase1",
    roundNumber: ROUND,
    step: "A1",
    type: input.type,
  });
}

/**
 * A player encounter as the client holds it: the JSON it receives, read through the encounter
 * schema the client's domain helpers run on.
 */
function asReceivedByClient(encounter: unknown) {
  return encounterSessionSchema.parse(JSON.parse(JSON.stringify(encounter)));
}

function json(value: unknown): string | undefined {
  return JSON.stringify(value);
}

function withoutActor(command: CombatRoundCommand | undefined) {
  if (!command) return command;
  const { createdByUserId: _actor, ...rest } = command;
  return rest;
}

function keysAnywhere(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) keysAnywhere(entry, found);
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) found.add(key);
      keysAnywhere(nested, found);
    }
  }
  return found;
}

function validModifierReviewTransaction() {
  const context = (rows: unknown[]) =>
    scenarioParticipantCombatContextSchema.parse({
      modifierBuckets: {
        general: rows,
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      },
    });
  const transaction = buildCanonicalCombatModifierReviewFromDraft({
    canonicalCutoff: 5,
    commandId: "command:review",
    createdAt: "2026-10-04T09:00:00.000Z",
    currentContext: context([]),
    draftContext: context([{ durationRounds: 2, id: "row-new", scope: "until", value: -10 }]),
    encounterId: "encounter-1",
    participantState: scenarioParticipantStateSchema.parse({
      combat: {},
      equipment: {},
      health: {},
      resources: {},
    }),
    phase: "M1",
    revision: "2026-10-04T09:00:00.000Z",
    roundNumber: ROUND,
    scenarioParticipantId: `scenario-${CONTROLLED}`,
  });
  expect(canonicalCombatModifierReviewTransactionSchema.safeParse(transaction).success).toBe(true);
  return transaction;
}

function distanceSide(participantId: string): CombatRoundEndDistanceControlSide {
  return {
    participantId,
    rolledAt: "2026-10-04T10:00:00.000Z",
    rolledAtRound: ROUND,
    rolledBy: "player",
    status: "rolled",
  } as unknown as CombatRoundEndDistanceControlSide;
}

function distanceProposal(input: {
  applied: boolean;
  participantAId: string;
  participantBId: string;
}): CombatRoundEndDistanceProposal {
  return combatRoundEndDistanceProposalSchema.parse({
    appliedDistance: input.applied ? 2 : undefined,
    appliesFromRound: ROUND + 1,
    currentDistance: 3,
    gmOverrideDistance: 2,
    id: `proposal:${input.participantAId}:${input.participantBId}:${input.applied}`,
    notes: "SECRET_PROPOSAL_NOTES",
    outcome: "participant_a_wins",
    pairKey: `${input.participantAId}|${input.participantBId}`,
    participantA: distanceSide(input.participantAId),
    participantAId: input.participantAId,
    participantB: distanceSide(input.participantBId),
    participantBId: input.participantBId,
    proposedDistance: 2,
    status: input.applied ? "committed" : "rolled",
    winnerParticipantId: input.participantAId,
  });
}

/**
 * Every command type the baseline decided by name, across the participant scopes and branch
 * conditions its decision depends on. `submit_phase_initiative_choice`, `declare_action` and
 * `roll_combat_experience` are included too: their uncontrolled or disarm branches were decided by
 * name, their controlled ordinary branches fell through.
 */
function namedTypeFixtures(): CombatRoundCommand[] {
  const fixtures: CombatRoundCommand[] = [];
  const participants = [CONTROLLED, VISIBLE, HIDDEN];
  const simpleNamedTypes: CombatRoundCommandType[] = [
    "transition_critical_bleed",
    "review_feint_feasibility",
    "roll_feint",
    "commit_feint_result",
    "respond_adjust_distance",
    "review_adjust_distance_roll_adjustment",
    "roll_adjust_distance",
    "commit_adjust_distance",
    "open_disarm",
    "roll_disarm",
    "commit_disarm",
    "commit_defense_review",
    "progress_missile_readiness",
    "interrupt_missile_readiness",
    "submit_phase_initiative_choice",
    "roll_combat_experience",
  ];
  for (const type of simpleNamedTypes) {
    for (const participantId of participants) {
      fixtures.push(makeCommand({ participantId, type }));
    }
  }
  for (const participantId of participants) {
    fixtures.push(
      makeCommand({
        facts: {
          actionId: "attack",
          attackOpportunityId: "opportunity-1",
          attackResultId: "attack-result-1",
          attackType: "melee",
          phase: "phase1",
          status: "submitted",
        },
        participantId,
        type: "roll_attack",
      }),
      makeCommand({
        facts: {
          observationAttemptId: "observation-1",
          relationshipId: "relationship-1",
          targetParticipantId: VISIBLE,
        },
        participantId,
        type: "roll_observation",
      }),
    );
    for (const facts of [
      { actionId: "disarm", status: "submitted", step: "DE" },
      { actionId: "parry_disarm", status: "submitted", step: "DE" },
      {
        actionId: "attack",
        disarm: { targetItemId: "SECRET_ITEM" },
        status: "gmEdited",
        step: "DE",
      },
      { actionId: "attack", previousDisarmAttempts: [], status: "submitted", step: "DE" },
      { actionId: "attack", status: "submitted", step: "DE" },
    ]) {
      fixtures.push(makeCommand({ facts, participantId, type: "declare_action" }));
    }
    for (const type of ["review_modifiers_phase1", "review_modifiers_phase2"] as const) {
      fixtures.push(
        makeCommand({
          facts: { modifierReview: validModifierReviewTransaction() },
          participantId,
          type,
        }),
        makeCommand({ facts: { modifierReview: { invalid: true } }, participantId, type }),
      );
    }
  }
  for (const [affected, controller] of [
    [CONTROLLED, VISIBLE],
    [VISIBLE, HIDDEN],
    [HIDDEN, HIDDEN],
  ] as const) {
    for (const continuedContactId of ["contact-1", undefined]) {
      fixtures.push(
        makeCommand({
          facts: {
            contactMaintained: true,
            contestId: "contest-1",
            continuedContactId,
            opponentParticipantId: controller,
            previousContinuedContact: {
              affectedParticipantId: affected,
              controllerParticipantId: controller,
              secret: "SECRET_CONTACT",
            },
            resolved: true,
            resultId: "result-1",
            rollId: "roll-1",
            rollPurpose: "maintain",
            unbalancedConditionId: "condition-1",
          },
          participantId: affected,
          type: "roll_continued_contact_maintenance",
        }),
      );
    }
  }
  for (const [participantAId, participantBId] of [
    [CONTROLLED, VISIBLE],
    [VISIBLE, CONTROLLED],
    [CONTROLLED, HIDDEN],
    [VISIBLE, HIDDEN],
  ] as const) {
    for (const applied of [true, false]) {
      for (const rolledParticipantId of [participantAId, participantBId]) {
        const proposal = distanceProposal({ applied, participantAId, participantBId });
        for (const type of [
          "roll_round_end_distance_control",
          "commit_round_end_distance_control",
        ] as const) {
          fixtures.push(
            makeCommand({
              facts: {
                appliedDistance: applied ? 2 : undefined,
                currentDistance: 3,
                distanceProposalId: proposal.id,
                nextEdge: { distance: 2 },
                nextProposal: proposal,
                pairKey: proposal.pairKey,
                participantAId,
                participantBId,
                previousProposal: { ...proposal, status: "pending" },
                rolledBy: "player",
                rolledParticipantFinalTotal: 14,
                rolledParticipantId,
                rolledParticipantRoll: 9,
              },
              participantId: rolledParticipantId,
              type,
            }),
          );
        }
      }
    }
  }
  return fixtures;
}

describe("#502 player command projection — byte-identical for types decided by name", () => {
  it("matches the baseline exactly, apart from the actor identity it now never carries", () => {
    const comparedByType = new Map<CombatRoundCommandType, number>();
    const fellThrough = new Set<string>();

    for (const command of namedTypeFixtures()) {
      const input = { command, ...scope };
      const baseline = buildPlayerSafeCombatRoundCommandForUser(input);
      const projected = projectPlayerCombatCommand(input);

      if (baseline === input.command) {
        // The baseline passed this one through raw; it is not part of the byte-identical set.
        fellThrough.add(`${command.type}:${command.participantId}`);
        continue;
      }

      expect(json(projected), `${command.type} ${command.id}`).toBe(json(withoutActor(baseline)));
      if (projected) expect(Object.hasOwn(projected, "createdByUserId")).toBe(false);
      comparedByType.set(command.type, (comparedByType.get(command.type) ?? 0) + 1);
    }

    // Every one of the 24 types the baseline named was compared on at least one input.
    expect([...comparedByType.keys()].sort()).toEqual(
      [
        "commit_adjust_distance",
        "commit_defense_review",
        "commit_disarm",
        "commit_feint_result",
        "commit_round_end_distance_control",
        "declare_action",
        "interrupt_missile_readiness",
        "open_disarm",
        "progress_missile_readiness",
        "respond_adjust_distance",
        "review_adjust_distance_roll_adjustment",
        "review_feint_feasibility",
        "review_modifiers_phase1",
        "review_modifiers_phase2",
        "roll_adjust_distance",
        "roll_attack",
        "roll_combat_experience",
        "roll_continued_contact_maintenance",
        "roll_disarm",
        "roll_feint",
        "roll_observation",
        "roll_round_end_distance_control",
        "submit_phase_initiative_choice",
        "transition_critical_bleed",
      ].sort(),
    );
    // Among the named types, only these controlled branches fell through to the raw command.
    expect([...fellThrough].sort()).toEqual(
      [
        `declare_action:${CONTROLLED}`,
        `roll_combat_experience:${CONTROLLED}`,
        `submit_phase_initiative_choice:${CONTROLLED}`,
      ].sort(),
    );
  });
});

describe("#502 player command projection — fail closed", () => {
  it("omits a command type it does not enumerate, which the baseline passed through raw", () => {
    const unknownType = {
      ...makeCommand({ type: "skip_phase_action" }),
      type: "future_secret_command",
    } as unknown as CombatRoundCommand;
    const input = { command: unknownType, ...scope };

    expect(buildPlayerSafeCombatRoundCommandForUser(input)).toBe(unknownType);
    expect(projectPlayerCombatCommand(input)).toBeUndefined();
  });

  it("does not treat inherited object members as decisions", () => {
    for (const type of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
      const command = {
        ...makeCommand({ type: "skip_phase_action" }),
        type,
      } as unknown as CombatRoundCommand;
      expect(projectPlayerCombatCommand({ command, ...scope }), type).toBeUndefined();
    }
  });

  it("decides every command type and leaves no raw command in any projected output", () => {
    for (const type of combatRoundCommandTypeSchema.options) {
      for (const participantId of [CONTROLLED, VISIBLE, HIDDEN]) {
        const command = makeCommand({ participantId, type });
        const projected = projectPlayerCombatCommand({ command, ...scope });
        expect(projected, `${type}:${participantId}`).not.toBe(command);
        if (!projected) continue;
        const keys = keysAnywhere(projected);
        for (const key of NAMED_PRIVATE_KEYS) expect(keys.has(key), `${type} ${key}`).toBe(false);
        expect(json(projected), type).not.toContain("SECRET");
      }
    }
  });
});

/**
 * The decision for every type that fell through to the raw stored command at the baseline.
 * `envelope` is public combat progression: the envelope without facts, for commands whose
 * participants the viewer can see. `controlled` is the same for the acting participant's controller
 * only. `omit` never reaches a player.
 */
const FORMERLY_RAW_DECISIONS: Record<string, "envelope" | "controlled" | "omit"> = {
  advance_combat_boundary: "envelope",
  advance_combat_task: "envelope",
  back_out_phase_attack: "envelope",
  cancel_combat_task: "envelope",
  commit_break_off: "envelope",
  commit_phase_damage: "envelope",
  commit_phase_initiative_resolution: "envelope",
  commit_round_end_participant_review: "controlled",
  complete_damage_review_phase1: "envelope",
  complete_damage_review_phase2: "envelope",
  complete_remaining_step: "envelope",
  complete_round: "envelope",
  decide_double_attack_phase2: "envelope",
  interrupt_combat_task: "envelope",
  prepare_round_end_review: "omit",
  resolve_combat_task: "envelope",
  resolve_damage: "envelope",
  review_break_off: "envelope",
  review_combat_task: "envelope",
  roll_break_off: "envelope",
  roll_combat_task: "envelope",
  roll_critical: "envelope",
  roll_hit_location: "envelope",
  roll_initiative_phase1: "envelope",
  roll_initiative_phase2: "envelope",
  roll_offensive_parry_brawling: "envelope",
  roll_parry: "envelope",
  roll_round_end_health_check: "controlled",
  set_pair_distance: "envelope",
  skip_phase_action: "envelope",
};

describe("#502 player command projection — types that used to fall through", () => {
  it("covers exactly the 30 types the baseline never named", () => {
    const neverNamed = combatRoundCommandTypeSchema.options.filter((type) => {
      const command = makeCommand({ type });
      return buildPlayerSafeCombatRoundCommandForUser({ command, ...scope }) === command;
    });
    // The three named types whose controlled branch fell through are decided separately below.
    expect(
      neverNamed
        .filter(
          (type) =>
            type !== "declare_action" &&
            type !== "submit_phase_initiative_choice" &&
            type !== "roll_combat_experience",
        )
        .sort(),
    ).toEqual(Object.keys(FORMERLY_RAW_DECISIONS).sort());
  });

  for (const [type, decision] of Object.entries(FORMERLY_RAW_DECISIONS)) {
    it(`${type}: ${decision}`, () => {
      const commandType = type as CombatRoundCommandType;
      const project = (input: Parameters<typeof makeCommand>[0]) =>
        projectPlayerCombatCommand({ command: makeCommand(input), ...scope });
      const envelopeOf = (command: CombatRoundCommand) => {
        const { createdByUserId: _actor, ...envelope } = command;
        return { ...envelope, facts: {} };
      };

      const controlled = project({ type: commandType });
      const visible = project({ participantId: VISIBLE, type: commandType });

      if (decision === "omit") {
        expect(controlled).toBeUndefined();
        expect(visible).toBeUndefined();
        return;
      }

      expect(json(controlled)).toBe(json(envelopeOf(makeCommand({ type: commandType }))));
      if (decision === "controlled") {
        expect(visible).toBeUndefined();
      } else {
        expect(json(visible)).toBe(
          json(envelopeOf(makeCommand({ participantId: VISIBLE, type: commandType }))),
        );
      }
      // A command naming a participant the viewer cannot see is omitted, wherever it names it.
      expect(project({ participantId: HIDDEN, type: commandType })).toBeUndefined();
      expect(project({ afterParticipantId: HIDDEN, type: commandType })).toBeUndefined();
      expect(project({ beforeParticipantId: HIDDEN, type: commandType })).toBeUndefined();
    });
  }

  it("cancel_combat_task: omits a declaration-boundary cancellation, keeps an opportunity one", () => {
    const taskUndo = (boundary: "declaration" | "opportunity") => ({
      actionId: "task-1",
      boundary,
      commandId: "command:cancel_combat_task:hero",
      kind: "cancel",
      phase: "phase1",
      previousDuration: { kind: "rounds", rounds: 2 },
      previousLastUpdatedAt: "2026-10-04T09:00:00.000Z",
      previousProgress: { completedRounds: 0 },
      previousStatus: "active",
      roundNumber: ROUND,
      version: 1,
    });
    const project = (facts: Record<string, unknown>) =>
      projectPlayerCombatCommand({
        command: makeCommand({ facts, type: "cancel_combat_task" }),
        ...scope,
      });

    expect(project({ taskUndo: taskUndo("declaration") })).toBeUndefined();
    expect(project({ taskUndo: taskUndo("opportunity") })?.facts).toEqual({});
    expect(project({})?.facts).toEqual({});
  });

  it("declare_action: the controlled ordinary declaration carries the declaration facts", () => {
    const projected = projectPlayerCombatCommand({
      command: makeCommand({
        facts: { actionId: "attack", status: "submitted", step: "DE" },
        type: "declare_action",
      }),
      ...scope,
    });

    expect(projected?.facts).toEqual({ actionId: "attack", status: "submitted", step: "DE" });
    expect(
      projectPlayerCombatCommand({
        command: makeCommand({
          afterParticipantId: HIDDEN,
          facts: { actionId: "attack", status: "submitted", step: "DE" },
          type: "declare_action",
        }),
        ...scope,
      }),
    ).toBeUndefined();
  });

  it("roll_combat_experience: the controlled roll is an envelope without facts", () => {
    expect(
      projectPlayerCombatCommand({
        command: makeCommand({ facts: { skillTotal: 30 }, type: "roll_combat_experience" }),
        ...scope,
      })?.facts,
    ).toEqual({});
  });

  it("submit_phase_initiative_choice: the player client reads back the same choice", () => {
    const encounter = encounterSessionSchema.parse({
      createdAt: "2026-10-04T08:00:00.000Z",
      currentRound: ROUND,
      id: "encounter-1",
      participants: [CONTROLLED, VISIBLE].map((id) => ({
        id,
        label: id,
        participantType: "scenario",
        scenarioParticipantId: `scenario-${id}`,
      })),
      title: "Bridge",
      updatedAt: "2026-10-04T08:00:00.000Z",
    });
    const state = initializeCombatRoundState({ encounter });
    const raw = makeCommand({
      facts: {
        attackActionId: "attack",
        attackStep: "A1",
        ceRequired: false,
        choice: "back_out",
        threatened: true,
      },
      type: "submit_phase_initiative_choice",
    });
    const projected = projectPlayerCombatCommand({ command: raw, ...scope });
    const read = (command: unknown) =>
      getCombatRoundPhaseInitiativeChoice({
        participantId: CONTROLLED,
        phase: "phase1",
        state: { ...state, commands: [command as CombatRoundCommand] },
      });

    expect(Object.keys(projected?.facts ?? {}).sort()).toEqual(
      [
        "attackActionId",
        "attackStep",
        "ceRequired",
        "choice",
        "combatExperience",
        "defaultedOnCommit",
        "threatened",
      ].sort(),
    );
    expect(read(raw)).toBeDefined();
    expect(read(projected)).toEqual({ ...read(raw), submittedByUserId: undefined });
  });
});

// ----- The player's own client re-derives the combat step from the projected command log. -----

const ACTORS = ["gladiator", "guard", "observer"] as const;
const OWNER: Record<string, string> = {
  gladiator: "player-1",
  guard: "player-2",
  observer: "player-3",
};

function encounterParticipant(id: string): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id,
    initiative: 0,
    label: id,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${id}`,
  };
}

function threeWayEncounter(combatRoundState?: CombatRoundState): EncounterSession {
  return encounterSessionSchema.parse({
    combatRoundState,
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: ROUND,
    id: "encounter-1",
    participants: ACTORS.map(encounterParticipant),
    scenarioId: "scenario-1",
    status: "active",
    title: "Three-way",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

function threeWayScenarioParticipants(): ScenarioParticipant[] {
  return ACTORS.map(
    (id) =>
      ({
        controlledByUserId: OWNER[id],
        createdAt: "2026-01-01T00:00:00.000Z",
        id: `scenario-${id}`,
        isActive: true,
        joinSource: "gm_added",
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: id },
        sourceType: "character",
        state: scenarioParticipantStateSchema.parse({
          combat: {},
          equipment: {},
          health: {},
          resources: {},
        }),
        updatedAt: "2026-01-01T00:00:00.000Z",
      }) as ScenarioParticipant,
  );
}

function phaseContext(targetParticipantId: string) {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    targetParticipantId,
  };
}

/** Declarations and initiative recorded with commands, as the routes record them. */
function openPhaseOne(initiativeOrder: readonly string[]): CombatRoundState {
  const targets: Record<string, string> = {
    gladiator: "guard",
    guard: "gladiator",
    observer: "guard",
  };
  let state = initializeCombatRoundState({ encounter: threeWayEncounter() });
  ACTORS.forEach((id, index) => {
    state = recordCombatRoundDeclaration({
      command: { createdAt: `2026-01-01T00:00:0${index}.000Z` },
      declaration: {
        actionId: "attack_parry",
        phaseContexts: { phase1: phaseContext(targets[id]!) },
        roundNumber: state.roundNumber,
      },
      participantId: id,
      state,
      submittedBy: "gm",
    });
  });
  state = {
    ...state,
    currentStep: "initiative_phase_1",
    selectedParticipantId: initiativeOrder[0],
    selectedStep: "initiative_phase_1",
  };
  const totals: Record<string, number> = { gladiator: 9, guard: 6, observer: 3 };
  initiativeOrder.forEach((id, index) => {
    state = recordCombatRoundInitiative({
      command: { createdAt: `2026-01-01T00:01:0${index}.000Z`, createdByUserId: "gm-1" },
      initiative: {
        baseInitiative: totals[id]! - 1,
        modifierAdjustment: 0,
        rolls: [1],
        rollTotal: 1,
        total: totals[id]!,
      },
      participantId: id,
      phase: "phase1",
      state,
      submittedBy: "gm",
    });
  });
  return initializeCombatRoundPhaseResolutionCursor({
    phase: "phase1",
    state,
    updatedAt: "2026-01-01T00:02:00.000Z",
  });
}

/** The gladiator attacks the guard and the guard's parry fails: the cursor is at the guard's D1. */
function attackAndFailedParry(state: CombatRoundState): CombatRoundState {
  const attackResult = buildCombatRoundAttackRollResult({
    actionId: "attack_parry",
    attackerParticipantId: "gladiator",
    defenderDb: 10,
    defenderParticipantId: "guard",
    ob: 10,
    phase: "phase1",
    rollD20: 14,
    rollTotal: 14,
    rolledAt: "2026-01-01T00:03:00.000Z",
    weaponName: "Broad sword",
  });
  const afterAttack = recordCombatRoundAttackResult({
    command: { createdAt: attackResult.rolledAt, createdByUserId: "gm-1" },
    participantId: "gladiator",
    result: attackResult,
    state,
    submittedBy: "gm",
  });
  const status = getCombatRoundPhaseResolutionStatus({
    participantId: "gladiator",
    phase: "phase1",
    state: afterAttack,
  });
  const parryReady =
    status.substep === "defense"
      ? combatRoundStateSchema.parse({
          ...afterAttack,
          phaseResolutionCursor: { participantId: "guard", phase: "phase1", substep: "parry" },
          phaseResolutionStatuses: {
            ...afterAttack.phaseResolutionStatuses,
            gladiator: {
              ...afterAttack.phaseResolutionStatuses.gladiator,
              phase1: { substep: "parry", updatedAt: "2026-01-01T00:03:30.000Z" },
            },
          },
        })
      : afterAttack;
  return recordCombatRoundParryResult({
    attackResult,
    command: { createdAt: "2026-01-01T00:04:00.000Z", createdByUserId: "gm-1" },
    parryResolution: {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 8,
      rollTotal: 8,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 17,
    },
    state: parryReady,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });
}

function skipGladiator(state: CombatRoundState): CombatRoundState {
  return skipCombatRoundCurrentPhaseAction({
    command: { createdAt: "2026-01-01T00:03:00.000Z", createdByUserId: "gm-1" },
    participantId: "gladiator",
    phase: "phase1",
    reason: "SECRET_GM_REASON",
    state,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:03:00.000Z",
  });
}

function progressionView(state: CombatRoundState) {
  return {
    currentCursor: state.currentCursor,
    currentStep: state.currentStep,
    phaseResolutionCursor: state.phaseResolutionCursor,
    phaseResolutionStatuses: state.phaseResolutionStatuses,
    stepStatuses: Object.fromEntries(
      state.participants.map((participant) => [
        participant.participantId,
        participant.stepStatuses,
      ]),
    ),
  };
}

describe("#502 player command projection — the player's client still derives the server's step", () => {
  const scenarios: Array<[string, () => CombatRoundState]> = [];
  for (const order of [
    ["gladiator", "guard", "observer"],
    ["observer", "gladiator", "guard"],
  ] as const) {
    scenarios.push([`phase 1 open (initiative ${order.join(",")})`, () => openPhaseOne(order)]);
    scenarios.push([
      `after a GM skip (initiative ${order.join(",")})`,
      () => skipGladiator(openPhaseOne(order)),
    ]);
    scenarios.push([
      `after an attack and failed parry (initiative ${order.join(",")})`,
      () => attackAndFailedParry(openPhaseOne(order)),
    ]);
  }

  for (const [label, buildState] of scenarios) {
    for (const viewer of ACTORS) {
      it(`${label}, viewed by ${viewer}`, () => {
        const server = buildState();
        const projected = buildPlayerFacingEncounterForUser({
          encounter: threeWayEncounter(server),
          scenarioParticipants: threeWayScenarioParticipants(),
          userId: OWNER[viewer]!,
        });

        const client = initializeCombatRoundState({ encounter: asReceivedByClient(projected) });

        expect(progressionView(client)).toEqual(progressionView(server));
        expect(json(projected.combatRoundState?.commands)).not.toContain("SECRET");
      });
    }
  }

  it("would not, if the formerly raw types were omitted instead of projected", () => {
    const server = skipGladiator(openPhaseOne(["gladiator", "guard", "observer"]));
    const projected = buildPlayerFacingEncounterForUser({
      encounter: threeWayEncounter(server),
      scenarioParticipants: threeWayScenarioParticipants(),
      userId: OWNER.gladiator!,
    });
    const withoutFormerlyRaw = projected.combatRoundState!.commands.filter(
      (command) => !(command.type in FORMERLY_RAW_DECISIONS),
    );

    const client = initializeCombatRoundState({
      encounter: asReceivedByClient({
        ...projected,
        combatRoundState: { ...projected.combatRoundState!, commands: withoutFormerlyRaw },
      }),
    });

    // The player's own skipped action would read as pending again.
    expect(progressionView(client)).not.toEqual(progressionView(server));
    expect(
      client.participants.find((entry) => entry.participantId === "gladiator")?.stepStatuses
        .phase_1_actions,
    ).toBe("pending");
  });
});

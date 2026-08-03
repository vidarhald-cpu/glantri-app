import {
  buildCombatAttackPhasePenaltyResultConsequences,
  combatAttackPhaseDefensivePenaltySchema,
} from "./combatAttackPhasePenalty";
import {
  combatRoundCommandSchema,
  combatRoundEndReviewSchema,
  combatRoundParticipantStateSchema,
  combatRoundPhaseResolutionResultSchema,
  combatRoundStepSnapshotSchema,
  getCombatRoundAttackResultId,
  getCombatRoundParticipantAttackResults,
  getCombatRoundDamageResultId,
  getCombatRoundEndDistanceProposalLifecycle,
  getPreviousCombatRoundStep,
  type CombatRoundCommand,
  type CombatRoundCommandType,
  type CombatRoundEndReview,
  type CombatRoundParticipantState,
  type CombatRoundPhase,
  type CombatRoundPhaseResolutionResult,
  type CombatRoundStep,
  type CombatRoundStepSnapshot,
} from "./combatRoundManager";
import { getCombatDeclarationActionLabel } from "./combatDeclarationValidation";
import {
  canonicalCombatModifierReviewPublicResultSchema,
  canonicalCombatModifierReviewTransactionSchema,
  projectCanonicalCombatModifierReviewPublicResult,
} from "./combatModifierReview";
import {
  combatStepEventSchema,
  type CombatStepEvent,
  type CombatStepEventFacts,
  type CombatStepEventHiddenIdentityFallback,
  type CombatStepEventIdentityRef,
  type CombatStepEventIdentityRole,
  type CombatStepEventOutcomeScope,
  type CombatStepEventSourceKind,
  type CombatStepEventStatus,
  type CombatStepEventType,
} from "./combatStepEventSchema";

export * from "./combatStepEventSchema";
export * from "./combatStepEventPersistence";

/**
 * Combat step events are immutable, chronological outcome history. Step snapshots remain the
 * exact replay source for the five historical inspector panels, while commands remain mutation
 * provenance and undo facts. Legacy projection only copies existing facts; it never recalculates
 * combat rules or applies viewer visibility.
 */

export interface DeriveLegacyCombatStepEventsInput {
  commands?: readonly unknown[];
  encounterId: string;
  participants?: readonly unknown[];
  phaseResolutionResults?: readonly unknown[];
  roundEndReview?: unknown;
  roundNumber: number;
  stepSnapshots?: readonly unknown[];
}

interface LegacyEventCandidate {
  commandIndex?: number;
  event: Omit<CombatStepEvent, "sequence">;
  sourceIndex: number;
  sourceRank: number;
}

const MISSING_TIMESTAMP = "occurredAt";

function stringFact(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberFact(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanFact(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function stringArrayFact(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function humanizeIdentifier(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function declarationTargetParticipantId(
  declaration: CombatRoundParticipantState["declaration"],
): string | undefined {
  if (!declaration) return undefined;
  return (
    declaration.secondaryActionContext?.targetParticipantId ??
    declaration.adjustDistance?.targetParticipantId ??
    declaration.feint?.targetParticipantId ??
    declaration.phaseContexts?.phase1?.targetParticipantId ??
    declaration.phaseContexts?.phase2?.targetParticipantId ??
    declaration.combatContext?.targetParticipantId ??
    declaration.combatContext?.selectedOpponentId
  );
}

function declarationMovementLabel(
  declaration: NonNullable<CombatRoundParticipantState["declaration"]>,
): string | undefined {
  if (declaration.movementIntent?.mode === "hold_position") return "Hold position";
  if (declaration.movementIntent?.mode === "set_distance_preferences") {
    return "Set distance preferences";
  }
  return declaration.movementId ? humanizeIdentifier(declaration.movementId) : undefined;
}

function declarationSecondaryActionLabel(
  declaration: NonNullable<CombatRoundParticipantState["declaration"]>,
): string | undefined {
  const action = declaration.secondaryActionContext?.action ?? declaration.secondaryActionId;
  return action ? getCombatDeclarationActionLabel(action) : undefined;
}

function phaseStep(
  phase: CombatRoundPhase,
  kind: "initiative" | "attack" | "parry" | "damage",
): CombatRoundStep {
  if (kind === "initiative") {
    return phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2";
  }
  if (kind === "attack") {
    return phase === "phase1" ? "phase_1_actions" : "phase_2_actions";
  }
  if (kind === "parry") {
    return phase === "phase1" ? "review_phase_2_actions" : "review_phase_2_damage";
  }
  return phase === "phase1" ? "phase_1_damage" : "phase_2_damage";
}

function deterministicEventId(input: {
  encounterId: string;
  roundNumber: number;
  sourceId: string;
  type: CombatStepEventType;
}): string {
  return `legacy:${input.encounterId}:${input.roundNumber}:${input.type}:${input.sourceId}`;
}

function makeIdentityRefs(input: {
  actorParticipantId?: string;
  attackerParticipantId?: string;
  defenderParticipantId?: string;
  rollerParticipantId?: string;
  targetParticipantId?: string;
}): CombatStepEventIdentityRef[] {
  const refs: CombatStepEventIdentityRef[] = [];
  const add = (
    participantId: string | undefined,
    role: CombatStepEventIdentityRole,
    hiddenIdentityFallback?: CombatStepEventHiddenIdentityFallback,
  ) => {
    if (
      participantId &&
      !refs.some((ref) => ref.participantId === participantId && ref.role === role)
    ) {
      refs.push({ hiddenIdentityFallback, participantId, role });
    }
  };

  add(input.actorParticipantId, "actor", "omit");
  add(input.targetParticipantId, "target", "unseen_target");
  add(input.attackerParticipantId, "attacker", "unseen_attacker");
  add(input.defenderParticipantId, "defender", "unseen_target");
  add(input.rollerParticipantId, "roller", "omit");
  return refs;
}

function buildCandidate(input: {
  command?: CombatRoundCommand;
  commandIndex?: number;
  encounterId: string;
  event: Omit<
    CombatStepEvent,
    | "combatEffectIds"
    | "completeness"
    | "encounterId"
    | "facts"
    | "id"
    | "missingFacts"
    | "roundNumber"
    | "schemaVersion"
    | "sequence"
    | "source"
    | "visibility"
  > & {
    completenessMissing?: string[];
    combatEffectIds?: string[];
    facts?: Partial<CombatStepEventFacts>;
    involvedParticipantIds?: string[];
    outcomeScope?: CombatStepEventOutcomeScope;
    sourceIds: string[];
    sourceKind: CombatStepEventSourceKind;
  };
  roundNumber: number;
  sourceIndex: number;
  sourceRank: number;
  sourceToken: string;
}): LegacyEventCandidate {
  const missingFacts = unique([
    ...(input.event.completenessMissing ?? []),
    ...(input.event.occurredAt ? [] : [MISSING_TIMESTAMP]),
  ]);
  const involvedParticipantIds = unique(
    input.event.involvedParticipantIds ?? [
      input.event.actorParticipantId,
      input.event.targetParticipantId,
      input.event.attackerParticipantId,
      input.event.defenderParticipantId,
    ],
  );
  const identityRefs = makeIdentityRefs(input.event);

  return {
    commandIndex: input.commandIndex,
    event: combatStepEventSchema.omit({ sequence: true }).parse({
      ...input.event,
      combatEffectIds: input.event.combatEffectIds ?? [],
      commandId: input.command?.id ?? input.event.commandId,
      completeness: missingFacts.length > 0 ? "incomplete" : "legacy_derived",
      encounterId: input.encounterId,
      facts: {
        gmReview: input.event.facts?.gmReview ?? {},
        involvedOutcome: input.event.facts?.involvedOutcome ?? {},
        resultPresentation: input.event.facts?.resultPresentation,
        publicOutcome: input.event.facts?.publicOutcome ?? {},
        rollerPrivate: input.event.facts?.rollerPrivate ?? {},
      },
      id: deterministicEventId({
        encounterId: input.encounterId,
        roundNumber: input.roundNumber,
        sourceId: input.sourceToken,
        type: input.event.type,
      }),
      missingFacts,
      roundNumber: input.roundNumber,
      schemaVersion: 1,
      source: {
        commandType: input.command?.type,
        kind: input.event.sourceKind,
        sourceIds: unique(input.event.sourceIds),
      },
      visibility: {
        identityRefs,
        involvedParticipantIds,
        outcomeScope: input.event.outcomeScope ?? "involved",
        rollerParticipantId: input.event.rollerParticipantId,
      },
    }),
    sourceIndex: input.sourceIndex,
    sourceRank: input.sourceRank,
  };
}

function parseLegacyInputs(input: DeriveLegacyCombatStepEventsInput) {
  const commands = (input.commands ?? []).flatMap((value, sourceIndex) => {
    const parsed = combatRoundCommandSchema.safeParse(value);
    return parsed.success && parsed.data.roundNumber === input.roundNumber
      ? [{ sourceIndex, value: parsed.data }]
      : [];
  });
  const participants = (input.participants ?? []).flatMap((value, sourceIndex) => {
    const parsed = combatRoundParticipantStateSchema.safeParse(value);
    return parsed.success ? [{ sourceIndex, value: parsed.data }] : [];
  });
  const resolutions = (input.phaseResolutionResults ?? []).flatMap((value, sourceIndex) => {
    const parsed = combatRoundPhaseResolutionResultSchema.safeParse(value);
    return parsed.success && parsed.data.roundNumber === input.roundNumber
      ? [{ sourceIndex, value: parsed.data }]
      : [];
  });
  const snapshots = (input.stepSnapshots ?? []).flatMap((value, sourceIndex) => {
    const parsed = combatRoundStepSnapshotSchema.safeParse(value);
    return parsed.success && parsed.data.roundNumber === input.roundNumber
      ? [{ sourceIndex, value: parsed.data }]
      : [];
  });
  const roundEndReviewResult = combatRoundEndReviewSchema.safeParse(input.roundEndReview);

  return {
    commands,
    participants,
    resolutions,
    roundEndReview:
      roundEndReviewResult.success && roundEndReviewResult.data.roundNumber === input.roundNumber
        ? roundEndReviewResult.data
        : undefined,
    snapshots,
  };
}

function findCommand(input: {
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  participantId?: string;
  phase?: CombatRoundPhase;
  type: CombatRoundCommandType;
}): { sourceIndex: number; value: CombatRoundCommand } | undefined {
  return input.commands.find(
    ({ value }) =>
      value.type === input.type &&
      (!input.participantId || value.participantId === input.participantId) &&
      (!input.phase || value.phase === input.phase),
  );
}

function attackResultIdFor(input: {
  attackOpportunityId?: string;
  attackerParticipantId?: string;
  defenderParticipantId?: string;
  phase: CombatRoundPhase;
  roundNumber: number;
}): string | undefined {
  return input.attackerParticipantId && input.defenderParticipantId
    ? getCombatRoundAttackResultId({
        result: {
          attackOpportunityId: input.attackOpportunityId,
          attackerParticipantId: input.attackerParticipantId,
          defenderParticipantId: input.defenderParticipantId,
          phase: input.phase,
        },
        roundNumber: input.roundNumber,
      })
    : undefined;
}

function commandByResultId(input: {
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  resultId?: string;
  type: CombatRoundCommandType;
}): { sourceIndex: number; value: CombatRoundCommand } | undefined {
  return input.commands.find(
    ({ value }) =>
      value.type === input.type &&
      (!input.resultId || stringFact(value.facts, "attackResultId") === input.resultId),
  );
}

function initiativeCandidates(input: {
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  encounterId: string;
  participant: CombatRoundParticipantState;
  participantIndex: number;
  roundNumber: number;
}): LegacyEventCandidate[] {
  return (["phase1", "phase2"] as const).flatMap((phase, phaseIndex) => {
    const initiative = input.participant.initiatives[phase];
    if (!initiative) return [];
    const command = findCommand({
      commands: input.commands,
      participantId: input.participant.participantId,
      phase,
      type: phase === "phase1" ? "roll_initiative_phase1" : "roll_initiative_phase2",
    });
    const bulkCommand = input.commands.find(
      ({ value }) =>
        value.type === "complete_remaining_step" &&
        value.phase === phase &&
        stringArrayFact(value.facts, "completedParticipantIds").includes(
          input.participant.participantId,
        ),
    );
    const sourceCommand = command ?? bulkCommand;
    const resolutionType = "resolutionType" in initiative ? initiative.resolutionType : undefined;
    const skipped = resolutionType === "gm_skipped" || resolutionType === "bulk_skipped";
    const missing = initiative.rolls.length === 0 && !skipped ? ["facts.rollerPrivate.rolls"] : [];

    return [
      buildCandidate({
        command: sourceCommand?.value,
        commandIndex: sourceCommand?.sourceIndex,
        encounterId: input.encounterId,
        event: {
          actorParticipantId: input.participant.participantId,
          completenessMissing: missing,
          facts: {
            publicOutcome: {
              resolutionType,
              total: initiative.total,
            },
            rollerPrivate: {
              baseInitiative: initiative.baseInitiative,
              modifierAdjustment: initiative.modifierAdjustment,
              resolutionType,
              rolls: initiative.rolls,
              rollTotal: initiative.rollTotal,
              total: initiative.total,
            },
          },
          involvedParticipantIds: [input.participant.participantId],
          occurredAt: sourceCommand?.value.createdAt ?? null,
          outcomeScope: "involved",
          ownerParticipantId: input.participant.participantId,
          phase,
          rollerParticipantId: input.participant.participantId,
          sourceIds: unique([sourceCommand?.value.id]),
          sourceKind: sourceCommand ? "legacy_command" : "legacy_result",
          status: skipped ? "skipped" : "recorded",
          step: phaseStep(phase, "initiative"),
          type: "initiative",
        },
        roundNumber: input.roundNumber,
        sourceIndex: input.participantIndex * 2 + phaseIndex,
        sourceRank: 1,
        sourceToken: sourceCommand?.value.id ?? `${input.participant.participantId}:${phase}`,
      }),
    ];
  });
}

function declarationCandidate(input: {
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  encounterId: string;
  participant: CombatRoundParticipantState;
  participantIndex: number;
  roundNumber: number;
}): LegacyEventCandidate | undefined {
  const declaration = input.participant.declaration;
  if (!declaration) return undefined;
  const command = [...input.commands]
    .reverse()
    .find(
      ({ value }) =>
        value.type === "declare_action" && value.participantId === input.participant.participantId,
    );

  const targetParticipantId = declarationTargetParticipantId(declaration);
  const actionLabel = getCombatDeclarationActionLabel(declaration.actionId);
  const movementLabel = declarationMovementLabel(declaration);
  const secondaryActionLabel = declarationSecondaryActionLabel(declaration);
  const detailRows = [
    `Action: ${actionLabel}`,
    ...(secondaryActionLabel ? [`Secondary action: ${secondaryActionLabel}`] : []),
    ...(movementLabel ? [`Movement: ${movementLabel}`] : []),
  ];

  return buildCandidate({
    command: command?.value,
    commandIndex: command?.sourceIndex,
    encounterId: input.encounterId,
    event: {
      actorParticipantId: input.participant.participantId,
      completenessMissing: declaration.actionId ? [] : ["facts.involvedOutcome.actionId"],
      facts: {
        involvedOutcome: {
          actionId: declaration.actionId,
          actionLabel,
          additionalActionNotes: declaration.additionalActionNotes,
          movementId: declaration.movementId,
          movementIntent: declaration.movementIntent,
          movementLabel,
          phaseContexts: declaration.phaseContexts,
          secondaryActionContext: declaration.secondaryActionContext,
          secondaryActionId: declaration.secondaryActionId,
          secondaryActionLabel,
          submittedBy: declaration.submittedBy,
          targetParticipantId,
        },
        resultPresentation: {
          actionInstanceId: command?.value.id ?? declaration.id,
          calculationReferences: [],
          committedConsequences: [],
          conciseOutcome: {
            details: detailRows,
            label: `${actionLabel} declared`,
          },
          privateDiagnostics: [],
          publicCombatNote: declaration.additionalActionNotes?.trim() || undefined,
          standardConsequences: [],
          subordinateEventReferences: [],
        },
      },
      involvedParticipantIds: [input.participant.participantId],
      occurredAt: declaration.submittedAt ?? command?.value.createdAt ?? null,
      outcomeScope: "involved",
      ownerParticipantId: input.participant.participantId,
      sourceIds: unique([command?.value.id]),
      sourceKind: command ? "legacy_command" : "legacy_result",
      status: "recorded",
      step: "select_actions",
      targetParticipantId,
      type: "declaration",
    },
    roundNumber: input.roundNumber,
    sourceIndex: input.participantIndex,
    sourceRank: 0,
    sourceToken: command?.value.id ?? input.participant.participantId,
  });
}

function attackCandidates(input: {
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  encounterId: string;
  participant: CombatRoundParticipantState;
  participantIndex: number;
  roundNumber: number;
}): LegacyEventCandidate[] {
  return getCombatRoundParticipantAttackResults({
    participant: input.participant,
    roundNumber: input.roundNumber,
  }).map((attack, attackIndex) => {
    const phase = attack.phase;
    const attackResultId = attackResultIdFor({ ...attack, roundNumber: input.roundNumber });
    const command = commandByResultId({
      commands: input.commands,
      resultId: attackResultId,
      type: "roll_attack",
    });

    return buildCandidate({
      command: command?.value,
      commandIndex: command?.sourceIndex,
      encounterId: input.encounterId,
      event: {
        actorParticipantId: attack.attackerParticipantId,
        attackResultId,
        attackerParticipantId: attack.attackerParticipantId,
        completenessMissing: unique([
          ...(attackResultId ? [] : ["attackResultId"]),
          ...(attack.attackerParticipantId ? [] : ["attackerParticipantId"]),
          ...(attack.defenderParticipantId ? [] : ["defenderParticipantId"]),
        ]),
        defenderParticipantId: attack.defenderParticipantId,
        facts: {
          involvedOutcome: {
            actionId: attack.actionId,
            attackIndex: attack.attackIndex,
            attackModeId: attack.attackModeId,
            attackOpportunityId: attack.attackOpportunityId,
            grazing: attack.grazing,
            hit: attack.hit,
            tableResult: attack.tableResult,
            weaponName: attack.weaponName,
            weaponSourceId: attack.weaponSourceId,
            weaponTemplateId: attack.weaponTemplateId,
          },
          publicOutcome: { grazing: attack.grazing, hit: attack.hit },
          rollerPrivate: {
            defenderDb: attack.defenderDb,
            lookupTotal: attack.lookupTotal,
            ob: attack.ob,
            openEndedD10s: attack.openEndedD10s,
            rollD20: attack.rollD20,
            rollTotal: attack.rollTotal,
          },
        },
        occurredAt: attack.rolledAt,
        ownerParticipantId: attack.attackerParticipantId,
        phase,
        rollerParticipantId: attack.attackerParticipantId,
        sourceIds: unique([command?.value.id, attackResultId]),
        sourceKind: command ? "legacy_command" : "legacy_result",
        status: "recorded",
        step: phaseStep(phase, "attack"),
        targetParticipantId: attack.defenderParticipantId,
        type: "attack",
      },
      roundNumber: input.roundNumber,
      sourceIndex: input.participantIndex * 100 + attackIndex,
      sourceRank: 2,
      sourceToken:
        command?.value.id ??
        attackResultId ??
        `${input.participant.participantId}:${phase}:${attackIndex}`,
    });
  });
}

function resolutionCandidates(input: {
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  encounterId: string;
  resolution: CombatRoundPhaseResolutionResult;
  resolutionIndex: number;
  roundNumber: number;
}): LegacyEventCandidate[] {
  const resolution = input.resolution;
  const shared = {
    attackResultId: resolution.attackResultId,
    attackerParticipantId: resolution.attackerParticipantId,
    defenderParticipantId: resolution.defenderParticipantId,
    phase: resolution.phase,
  };
  const baseMissing = unique([
    ...(resolution.attackResultId ? [] : ["attackResultId"]),
    ...(resolution.attackerParticipantId ? [] : ["attackerParticipantId"]),
    ...(resolution.defenderParticipantId ? [] : ["defenderParticipantId"]),
  ]);
  const candidates: LegacyEventCandidate[] = [];

  if (resolution.parryResolution.status !== "pending") {
    const command = commandByResultId({
      commands: input.commands,
      resultId: resolution.attackResultId,
      type: "roll_parry",
    });
    const parryResultId = resolution.damageResult?.parryResultId;
    candidates.push(
      buildCandidate({
        command: command?.value,
        commandIndex: command?.sourceIndex,
        encounterId: input.encounterId,
        event: {
          ...shared,
          completenessMissing: unique([
            ...baseMissing,
            ...(resolution.parryResolution.status === "resolved" && !parryResultId
              ? ["parryResultId"]
              : []),
            ...(resolution.parryResolution.status === "resolved" &&
            resolution.parryResolution.rollD20 === undefined
              ? ["facts.rollerPrivate.rollD20"]
              : []),
          ]),
          facts: {
            involvedOutcome: {
              resultLabel: resolution.parryResolution.resultLabel,
              status: resolution.parryResolution.status,
              success: resolution.parryResolution.success,
            },
            publicOutcome: {
              status: resolution.parryResolution.status,
              success: resolution.parryResolution.success,
            },
            rollerPrivate: {
              combinedParryScore: resolution.parryResolution.combinedParryScore,
              modifierAdjustment: resolution.parryResolution.modifierAdjustment,
              modifierBreakdown: resolution.parryResolution.modifierBreakdown,
              openEndedD10s: resolution.parryResolution.openEndedD10s,
              rollD20: resolution.parryResolution.rollD20,
              rollTotal: resolution.parryResolution.rollTotal,
              total: resolution.parryResolution.total,
            },
          },
          occurredAt: command?.value.createdAt ?? resolution.updatedAt,
          ownerParticipantId: resolution.defenderParticipantId,
          parryResultId,
          rollerParticipantId:
            resolution.parryResolution.status === "resolved"
              ? resolution.defenderParticipantId
              : undefined,
          sourceIds: unique([command?.value.id, resolution.attackResultId, parryResultId]),
          sourceKind: command ? "legacy_command" : "legacy_result",
          status:
            resolution.parryResolution.status === "not_applicable" ? "not_applicable" : "recorded",
          step: phaseStep(resolution.phase, "parry"),
          type: "parry",
        },
        roundNumber: input.roundNumber,
        sourceIndex: input.resolutionIndex,
        sourceRank: 3,
        sourceToken: command?.value.id ?? `${resolution.attackResultId}:parry`,
      }),
    );
  }

  if (resolution.hitLocationRoll.status === "rolled") {
    const command = commandByResultId({
      commands: input.commands,
      resultId: resolution.attackResultId,
      type: "roll_hit_location",
    });
    candidates.push(
      buildCandidate({
        command: command?.value,
        commandIndex: command?.sourceIndex,
        encounterId: input.encounterId,
        event: {
          ...shared,
          completenessMissing: unique([
            ...baseMissing,
            ...(resolution.hitLocationRoll.hitLocationRolls.length > 0
              ? []
              : ["facts.rollerPrivate.hitLocationRolls"]),
            ...(resolution.hitLocationRoll.rolledByParticipantId ? [] : ["rollerParticipantId"]),
          ]),
          facts: {
            involvedOutcome: {
              selectedHitLocation: resolution.hitLocationRoll.selectedHitLocation,
              targetLocation: resolution.hitLocationRoll.targetLocation,
            },
            rollerPrivate: {
              hitLocationRolls: resolution.hitLocationRoll.hitLocationRolls,
              selectedHitLocationRoll: resolution.hitLocationRoll.selectedHitLocationRoll,
              selectionReason: resolution.hitLocationRoll.selectionReason,
            },
          },
          occurredAt: resolution.hitLocationRoll.rolledAt ?? command?.value.createdAt ?? null,
          ownerParticipantId: resolution.defenderParticipantId,
          rollerParticipantId: resolution.hitLocationRoll.rolledByParticipantId,
          sourceIds: unique([command?.value.id, resolution.attackResultId]),
          sourceKind: command ? "legacy_command" : "legacy_result",
          status: "recorded",
          step: phaseStep(resolution.phase, "damage"),
          type: "hit_location",
        },
        roundNumber: input.roundNumber,
        sourceIndex: input.resolutionIndex,
        sourceRank: 4,
        sourceToken: command?.value.id ?? `${resolution.attackResultId}:location`,
      }),
    );
  }

  if (resolution.damageResult) {
    const command = commandByResultId({
      commands: input.commands,
      resultId: resolution.attackResultId,
      type: "resolve_damage",
    });
    const damageResultId = getCombatRoundDamageResultId({
      attackResultId: resolution.attackResultId,
    });
    candidates.push(
      buildCandidate({
        command: command?.value,
        commandIndex: command?.sourceIndex,
        encounterId: input.encounterId,
        event: {
          ...shared,
          completenessMissing: baseMissing,
          damageResultId,
          facts: {
            gmReview: resolution.damageResult.review ?? {},
            involvedOutcome: {
              criticalGrade: resolution.damageResult.criticalGrade,
              selectedHitLocation: resolution.damageResult.selectedHitLocation,
              totalDamage: resolution.damageResult.totalDamage,
            },
            rollerPrivate: {
              armorModifier: resolution.damageResult.armorModifier,
              damageLookupTotal: resolution.damageResult.damageLookupTotal,
              damageRoll: resolution.damageResult.damageRoll,
              defenderDm: resolution.damageResult.defenderDm,
              dmb: resolution.damageResult.dmb,
              hitLookupTotal: resolution.damageResult.hitLookupTotal,
            },
          },
          occurredAt: resolution.damageResult.createdAt,
          ownerParticipantId: resolution.defenderParticipantId,
          sourceIds: unique([command?.value.id, resolution.attackResultId, damageResultId]),
          sourceKind: command ? "legacy_command" : "legacy_result",
          status: "proposed",
          step: phaseStep(resolution.phase, "damage"),
          type: "damage_proposed",
        },
        roundNumber: input.roundNumber,
        sourceIndex: input.resolutionIndex,
        sourceRank: 5,
        sourceToken: command?.value.id ?? damageResultId,
      }),
    );
  }

  if (resolution.criticalRoll.status === "rolled") {
    const command = commandByResultId({
      commands: input.commands,
      resultId: resolution.attackResultId,
      type: "roll_critical",
    });
    candidates.push(
      buildCandidate({
        command: command?.value,
        commandIndex: command?.sourceIndex,
        encounterId: input.encounterId,
        event: {
          ...shared,
          completenessMissing: unique([
            ...baseMissing,
            ...(resolution.criticalRoll.criticalDice ? [] : ["facts.rollerPrivate.criticalDice"]),
            ...(resolution.criticalRoll.rolledByParticipantId ? [] : ["rollerParticipantId"]),
          ]),
          facts: {
            involvedOutcome: {
              criticalGrade: resolution.criticalRoll.criticalGrade,
              selectedHitLocation: resolution.criticalRoll.selectedHitLocation,
            },
            rollerPrivate: {
              armorCriticalModifier: resolution.criticalRoll.armorCriticalModifier,
              criticalDice: resolution.criticalRoll.criticalDice,
              criticalDiceTotal: resolution.criticalRoll.criticalDiceTotal,
              criticalTypeModifier: resolution.criticalRoll.criticalTypeModifier,
              finalCriticalRoll: resolution.criticalRoll.finalCriticalRoll,
            },
          },
          occurredAt: resolution.criticalRoll.rolledAt ?? command?.value.createdAt ?? null,
          ownerParticipantId: resolution.defenderParticipantId,
          rollerParticipantId: resolution.criticalRoll.rolledByParticipantId,
          sourceIds: unique([command?.value.id, resolution.attackResultId]),
          sourceKind: command ? "legacy_command" : "legacy_result",
          status: "recorded",
          step: phaseStep(resolution.phase, "damage"),
          type: "critical",
        },
        roundNumber: input.roundNumber,
        sourceIndex: input.resolutionIndex,
        sourceRank: 6,
        sourceToken: command?.value.id ?? `${resolution.attackResultId}:critical`,
      }),
    );
  }

  if (resolution.damageProposal.status === "committed") {
    const command = commandByResultId({
      commands: input.commands,
      resultId: resolution.attackResultId,
      type: "commit_phase_damage",
    });
    const facts = command?.value.facts ?? {};
    candidates.push(
      buildCandidate({
        command: command?.value,
        commandIndex: command?.sourceIndex,
        encounterId: input.encounterId,
        event: {
          ...shared,
          combatEffectEventId:
            resolution.damageProposal.committedCombatEffectEventId ??
            stringFact(facts, "createdCombatEffectEventId"),
          combatEffectIds:
            resolution.damageProposal.committedCombatEffectIds.length > 0
              ? resolution.damageProposal.committedCombatEffectIds
              : stringArrayFact(facts, "createdCombatEffectIds"),
          completenessMissing: baseMissing,
          damageResultId: getCombatRoundDamageResultId({
            attackResultId: resolution.attackResultId,
          }),
          facts: {
            gmReview: {
              additionalEffects: facts.additionalEffects,
              cancelledActions: facts.cancelledActions,
              computedCriticalGrade: facts.computedCriticalGrade,
            },
            involvedOutcome: {
              finalCommittedDamage: facts.finalCommittedDamage,
              status: resolution.damageProposal.status,
            },
            publicOutcome: { status: "committed" },
          },
          occurredAt: command?.value.createdAt ?? resolution.updatedAt,
          ownerParticipantId: resolution.defenderParticipantId,
          sourceIds: unique([
            command?.value.id,
            resolution.attackResultId,
            resolution.damageProposal.committedCombatEffectEventId,
            ...resolution.damageProposal.committedCombatEffectIds,
          ]),
          sourceKind: command ? "legacy_command" : "legacy_result",
          status: "committed",
          step: phaseStep(resolution.phase, "damage"),
          type: "damage_committed",
        },
        roundNumber: input.roundNumber,
        sourceIndex: input.resolutionIndex,
        sourceRank: 7,
        sourceToken: command?.value.id ?? `${resolution.attackResultId}:committed`,
      }),
    );
  }

  return candidates;
}

function distanceCandidates(input: {
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  encounterId: string;
  roundEndReview?: CombatRoundEndReview;
  roundNumber: number;
}): LegacyEventCandidate[] {
  const proposals = input.roundEndReview?.proposedDistances ?? [];
  return proposals.flatMap((proposal, proposalIndex) => {
    const candidates: LegacyEventCandidate[] = [];
    ([proposal.participantA, proposal.participantB] as const).forEach((side, sideIndex) => {
      if (!side.result) return;
      const command = input.commands.find(
        ({ value }) =>
          value.type === "roll_round_end_distance_control" &&
          stringFact(value.facts, "distanceProposalId") === proposal.id &&
          stringFact(value.facts, "rolledParticipantId") === side.participantId,
      );
      candidates.push(
        buildCandidate({
          command: command?.value,
          commandIndex: command?.sourceIndex,
          encounterId: input.encounterId,
          event: {
            actorParticipantId: side.participantId,
            distanceProposalId: proposal.id,
            facts: {
              involvedOutcome: { currentDistance: proposal.currentDistance },
              rollerPrivate: {
                dodgeSkillTotal: side.result.dodgeSkillTotal,
                finalTotal: side.result.finalTotal,
                generalFatigueModifier: side.result.generalFatigueModifier,
                openEndedD10s: side.result.openEndedD10s,
                rollD20: side.result.rollD20,
                rollTotal: side.result.rollTotal,
                skillContestCalculation: side.result.skillContestCalculation,
              },
            },
            involvedParticipantIds: [proposal.participantAId, proposal.participantBId],
            occurredAt: side.result.rolledAt,
            ownerParticipantId: side.participantId,
            rollerParticipantId: side.participantId,
            sourceIds: unique([command?.value.id, proposal.id]),
            sourceKind: command ? "legacy_command" : "legacy_result",
            status: "recorded",
            step: "round_summary",
            targetParticipantId:
              side.participantId === proposal.participantAId
                ? proposal.participantBId
                : proposal.participantAId,
            type: "distance_control_roll",
          },
          roundNumber: input.roundNumber,
          sourceIndex: proposalIndex * 2 + sideIndex,
          sourceRank: 8,
          sourceToken: command?.value.id ?? `${proposal.id}:${side.participantId}:roll`,
        }),
      );
    });

    const lifecycle = getCombatRoundEndDistanceProposalLifecycle(proposal);
    const resultKnown = lifecycle === "resolved" || lifecycle === "applied";
    if (resultKnown) {
      const commitCommand = input.commands.find(
        ({ value }) =>
          value.type === "commit_round_end_distance_control" &&
          stringFact(value.facts, "distanceProposalId") === proposal.id,
      );
      candidates.push(
        buildCandidate({
          command: commitCommand?.value,
          commandIndex: commitCommand?.sourceIndex,
          encounterId: input.encounterId,
          event: {
            distanceProposalId: proposal.id,
            facts: {
              involvedOutcome: {
                outcome: proposal.outcome,
                proposedDistance: proposal.proposedDistance,
                winnerParticipantId: proposal.winnerParticipantId,
              },
            },
            involvedParticipantIds: [proposal.participantAId, proposal.participantBId],
            occurredAt: commitCommand?.value.createdAt ?? null,
            ownerParticipantId: proposal.winnerParticipantId ?? proposal.participantAId,
            sourceIds: [proposal.id],
            sourceKind: "legacy_result",
            status: "recorded",
            step: "round_summary",
            type: "distance_control_result",
          },
          roundNumber: input.roundNumber,
          sourceIndex: proposalIndex,
          sourceRank: 9,
          sourceToken: `${proposal.id}:result`,
        }),
      );
    }

    if (lifecycle === "applied") {
      const command = input.commands.find(
        ({ value }) =>
          value.type === "commit_round_end_distance_control" &&
          stringFact(value.facts, "distanceProposalId") === proposal.id,
      );
      candidates.push(
        buildCandidate({
          command: command?.value,
          commandIndex: command?.sourceIndex,
          encounterId: input.encounterId,
          event: {
            distanceProposalId: proposal.id,
            facts: {
              publicOutcome: {
                appliedDistance: proposal.appliedDistance,
                appliesFromRound: proposal.appliesFromRound,
              },
            },
            involvedParticipantIds: [proposal.participantAId, proposal.participantBId],
            occurredAt: command?.value.createdAt ?? null,
            ownerParticipantId: proposal.winnerParticipantId ?? proposal.participantAId,
            outcomeScope: "perceived",
            sourceIds: unique([command?.value.id, proposal.id]),
            sourceKind: command ? "legacy_command" : "legacy_result",
            status: "committed",
            step: "round_summary",
            type: "distance_control_applied",
          },
          roundNumber: input.roundNumber,
          sourceIndex: proposalIndex,
          sourceRank: 10,
          sourceToken: command?.value.id ?? `${proposal.id}:applied`,
        }),
      );
    }
    return candidates;
  });
}

function roundEndParticipantCandidates(input: {
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  encounterId: string;
  roundEndReview?: CombatRoundEndReview;
  roundNumber: number;
}): LegacyEventCandidate[] {
  return Object.values(input.roundEndReview?.participantReviews ?? {}).flatMap(
    (review, reviewIndex) => {
      const candidates: LegacyEventCandidate[] = review.proposedHealthRolls.flatMap(
        (healthRoll, healthIndex) => {
          if (!healthRoll.result) return [];
          const command = input.commands.find(
            ({ value }) =>
              value.type === "roll_round_end_health_check" &&
              stringFact(value.facts, "healthRollId") === healthRoll.id,
          );
          return [
            buildCandidate({
              command: command?.value,
              commandIndex: command?.sourceIndex,
              encounterId: input.encounterId,
              event: {
                actorParticipantId: review.participantId,
                facts: {
                  involvedOutcome: {
                    bleedType: healthRoll.bleedType,
                    nextBleedRate: healthRoll.nextBleedRate,
                    success: healthRoll.result.success,
                  },
                  rollerPrivate: {
                    difficulty: healthRoll.result.difficulty,
                    finalTotal: healthRoll.result.finalTotal,
                    healthStat: healthRoll.result.healthStat,
                    openEndedD10s: healthRoll.result.openEndedD10s,
                    rollD20: healthRoll.result.rollD20,
                    rollTotal: healthRoll.result.rollTotal,
                  },
                  resultPresentation: {
                    actionInstanceId: review.canonicalReview?.reviewId,
                    calculationReferences: [
                      {
                        kind: "roller_private",
                        ownerParticipantId: review.participantId,
                        sourceId: healthRoll.id,
                        visibility: "owner",
                      },
                    ],
                    committedConsequences: [],
                    conciseOutcome: {
                      details: [healthRoll.result.success ? "Succeeded" : "Failed"],
                      label: "Health check",
                    },
                    privateDiagnostics: [],
                    standardConsequences: [],
                    subordinateEventReferences: [],
                  },
                },
                healthRollId: healthRoll.id,
                involvedParticipantIds: [review.participantId],
                occurredAt: healthRoll.result.rolledAt,
                ownerParticipantId: review.participantId,
                rollerParticipantId: review.participantId,
                sourceIds: unique([command?.value.id, healthRoll.id, healthRoll.sourceEffectId]),
                sourceKind: command ? "legacy_command" : "legacy_result",
                status: "recorded",
                step: "round_summary",
                type: "health_check",
              },
              roundNumber: input.roundNumber,
              sourceIndex: reviewIndex * 100 + healthIndex,
              sourceRank: 11,
              sourceToken: command?.value.id ?? healthRoll.id,
            }),
          ];
        },
      );

      if (review.status !== "pending") {
        const command = findCommand({
          commands: input.commands,
          participantId: review.participantId,
          type: "commit_round_end_participant_review",
        });
        const changeSummaries = [
          ...review.proposedDamage
            .filter((proposal) => proposal.accepted)
            .map((proposal) => `${proposal.label}: ${proposal.amount} damage`),
          ...review.proposedEffects
            .filter((proposal) => proposal.accepted)
            .map((proposal) =>
              [
                proposal.label,
                proposal.nextDuration
                  ? `duration ${proposal.nextDuration}`
                  : proposal.nextExpiresAtRound
                    ? `expires round ${proposal.nextExpiresAtRound}`
                    : "updated",
              ].join(": "),
            ),
          ...review.proposedRemovals
            .filter((proposal) => proposal.accepted)
            .map((proposal) => `${proposal.label}: expired`),
        ];
        candidates.push(
          buildCandidate({
            command: command?.value,
            commandIndex: command?.sourceIndex,
            encounterId: input.encounterId,
            event: {
              actorParticipantId: review.participantId,
              facts: {
                gmReview: {
                  proposedDamage: review.proposedDamage,
                  proposedEffects: review.proposedEffects,
                  proposedRemovals: review.proposedRemovals,
                  warnings: review.warnings,
                },
                involvedOutcome: { status: review.status },
                resultPresentation: {
                  actionInstanceId:
                    review.canonicalReview?.reviewId ?? command?.value.id,
                  calculationReferences: [],
                  committedConsequences: [],
                  conciseOutcome: {
                    details: changeSummaries.length ? changeSummaries : ["No changes"],
                    label: "Round-end review",
                  },
                  privateDiagnostics: [],
                  standardConsequences: [],
                  subordinateEventReferences: [],
                },
                publicOutcome: {
                  changeSummaries,
                  changed: changeSummaries.length > 0,
                },
              },
              involvedParticipantIds: [review.participantId],
              occurredAt: review.committedAt ?? command?.value.createdAt ?? null,
              ownerParticipantId: review.participantId,
              sourceIds: unique([command?.value.id]),
              sourceKind: command ? "legacy_command" : "legacy_result",
              status:
                review.status === "committed" || review.status === "complete"
                  ? "committed"
                  : "recorded",
              step: "round_summary",
              type: "participant_su_review",
            },
            roundNumber: input.roundNumber,
            sourceIndex: reviewIndex,
            sourceRank: 12,
            sourceToken: command?.value.id ?? `${review.participantId}:su-review`,
          }),
        );
      }
      return candidates;
    },
  );
}

function modifierSnapshotFacts(
  snapshots: Array<{ sourceIndex: number; value: CombatRoundStepSnapshot }>,
  participantId: string,
  step: CombatRoundStep,
): Array<{
  category: string;
  entries: Array<{
    durationRounds?: number;
    id: string;
    notes?: string;
    scope: string;
    value: number;
  }>;
  total: number;
}> {
  const snapshot = [...snapshots]
    .reverse()
    .find(({ value }) => value.participantId === participantId && value.step === step)?.value;
  return (snapshot?.modifierSummary?.rows ?? []).flatMap((row) => {
    const entries = row.entries
      .filter((entry) => entry.value !== 0)
      .map((entry) => ({
        durationRounds: entry.durationRounds,
        id: entry.id,
        notes: entry.notes,
        scope: entry.scope,
        value: entry.value,
      }));
    return entries.length || row.total !== 0
      ? [{ category: row.label, entries, total: row.total }]
      : [];
  });
}

function modifierSnapshotChangeFacts(input: {
  participantId: string;
  snapshots: Array<{ sourceIndex: number; value: CombatRoundStepSnapshot }>;
  step: "review_action_modifiers" | "review_phase_2_modifiers";
}): Array<{
  category: string;
  changeType: "added" | "changed" | "removed";
  durationRounds?: number;
  id: string;
  notes?: string;
  previousValue?: number;
  scope: string;
  value: number;
}> {
  const current = modifierSnapshotFacts(input.snapshots, input.participantId, input.step);
  const previousStep = getPreviousCombatRoundStep(input.step);
  const previous = previousStep
    ? modifierSnapshotFacts(input.snapshots, input.participantId, previousStep)
    : [];
  const flatten = (
    rows: ReturnType<typeof modifierSnapshotFacts>,
  ): Map<
    string,
    {
      category: string;
      durationRounds?: number;
      id: string;
      notes?: string;
      scope: string;
      value: number;
    }
  > =>
    new Map(
      rows.flatMap((row) =>
        row.entries.map((entry) => [
          entry.id,
          {
            category: row.category,
            ...entry,
          },
        ]),
      ),
    );
  const currentEntries = flatten(current);
  const previousEntries = flatten(previous);
  return [
    ...[...currentEntries.values()].flatMap((entry) => {
      const prior = previousEntries.get(entry.id);
      if (
        prior &&
        prior.category === entry.category &&
        prior.durationRounds === entry.durationRounds &&
        prior.notes === entry.notes &&
        prior.scope === entry.scope &&
        prior.value === entry.value
      ) {
        return [];
      }
      return [
        {
          ...entry,
          changeType: prior ? ("changed" as const) : ("added" as const),
          previousValue: prior?.value,
        },
      ];
    }),
    ...[...previousEntries.values()].flatMap((entry) =>
      currentEntries.has(entry.id)
        ? []
        : [{ ...entry, changeType: "removed" as const, previousValue: entry.value, value: 0 }],
    ),
  ].sort(
    (left, right) => left.category.localeCompare(right.category) || left.id.localeCompare(right.id),
  );
}

function workflowCommandCandidates(input: {
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  encounterId: string;
  roundNumber: number;
  snapshots: Array<{ sourceIndex: number; value: CombatRoundStepSnapshot }>;
}): LegacyEventCandidate[] {
  return input.commands.flatMap(({ sourceIndex, value: command }): LegacyEventCandidate[] => {
    const make = (event: Parameters<typeof buildCandidate>[0]["event"], sourceRank: number) =>
      buildCandidate({
        command,
        commandIndex: sourceIndex,
        encounterId: input.encounterId,
        event,
        roundNumber: input.roundNumber,
        sourceIndex,
        sourceRank,
        sourceToken: command.id,
      });

    if (command.type === "review_modifiers_phase1" || command.type === "review_modifiers_phase2") {
      if (command.facts.suppressNoChangeResult === true) return [];
      const step =
        command.type === "review_modifiers_phase1"
          ? "review_action_modifiers"
          : "review_phase_2_modifiers";
      const acceptedModifiers = modifierSnapshotFacts(input.snapshots, command.participantId, step);
      const snapshotAvailable = input.snapshots.some(
        ({ value }) => value.participantId === command.participantId && value.step === step,
      );
      const changes = modifierSnapshotChangeFacts({
        participantId: command.participantId,
        snapshots: input.snapshots,
        step,
      });
      const canonicalReview = canonicalCombatModifierReviewTransactionSchema.safeParse(
        command.facts.modifierReview,
      );
      const publicReview = canonicalCombatModifierReviewPublicResultSchema.safeParse(
        command.facts.modifierReviewPublicResult,
      );
      const canonicalPublicReview = canonicalReview.success
        ? projectCanonicalCombatModifierReviewPublicResult({ transaction: canonicalReview.data })
        : undefined;
      const acceptedReview = canonicalPublicReview ?? (publicReview.success ? publicReview.data : undefined);
      const resultLabel = acceptedReview
        ? acceptedReview.resultLabel
        : snapshotAvailable
          ? changes.length
            ? "Changes accepted"
            : "No changes"
          : "Modifier state accepted";
      const acceptedChanges = acceptedReview?.changes ?? changes;
      return [
        make(
          {
            actorParticipantId: command.participantId,
            facts: {
              involvedOutcome: {
                acceptedModifiers,
                changed: acceptedReview
                  ? acceptedReview.changed
                  : snapshotAvailable
                    ? changes.length > 0
                    : undefined,
                changes: acceptedChanges,
                resultLabel,
                resolutionType: "accepted",
              },
              resultPresentation: {
                actionInstanceId: command.id,
                calculationReferences: [],
                committedConsequences: [],
                conciseOutcome: {
                  details: [
                    resultLabel,
                    ...(acceptedReview?.publicNote
                      ? [acceptedReview.publicNote]
                      : []),
                  ],
                  label: "Modifier review",
                },
                privateDiagnostics: [],
                standardConsequences: [],
                subordinateEventReferences: [],
              },
            },
            involvedParticipantIds: [command.participantId],
            occurredAt: command.createdAt,
            ownerParticipantId: command.participantId,
            outcomeScope: "involved",
            sourceIds: [command.id],
            sourceKind: "legacy_command",
            status: "committed",
            step,
            type: "modifier_review",
          },
          2,
        ),
      ];
    }

    if (command.type === "complete_remaining_step") {
      const completedParticipantIds = stringArrayFact(command.facts, "completedParticipantIds");
      const step = stringFact(command.facts, "step");
      if (step !== "review_action_modifiers" && step !== "review_phase_2_modifiers") {
        return [];
      }
      return completedParticipantIds.map((participantId, participantIndex) => {
        const acceptedModifiers = modifierSnapshotFacts(input.snapshots, participantId, step);
        return buildCandidate({
          command,
          commandIndex: sourceIndex,
          encounterId: input.encounterId,
          event: {
            actorParticipantId: participantId,
            facts: {
              involvedOutcome: {
                acceptedModifiers,
                changed: false,
                resolutionType: "accepted_unchanged",
                source: "gm_bulk_completion",
              },
              resultPresentation: {
                actionInstanceId: `${command.id}:${participantId}`,
                calculationReferences: [],
                committedConsequences: [],
                conciseOutcome: {
                  details: ["No changes"],
                  label: "Modifier review",
                },
                privateDiagnostics: [],
                standardConsequences: [],
                subordinateEventReferences: [],
              },
            },
            involvedParticipantIds: [participantId],
            occurredAt: command.createdAt,
            ownerParticipantId: participantId,
            outcomeScope: "involved",
            sourceIds: [command.id],
            sourceKind: "legacy_command",
            status: "committed",
            step,
            type: "modifier_review",
          },
          roundNumber: input.roundNumber,
          sourceIndex: sourceIndex * 100 + participantIndex,
          sourceRank: 2,
          sourceToken: `${command.id}:${participantId}`,
        });
      });
    }

    if (
      command.type === "skip_phase_action" ||
      command.type === "back_out_phase_attack" ||
      (command.type === "submit_phase_initiative_choice" &&
        stringFact(command.facts, "choice") === "back_out") ||
      (command.type === "decide_double_attack_phase2" &&
        stringFact(command.facts, "decision") === "cancel")
    ) {
      const step = command.phase === "phase2" ? "phase_2_actions" : "phase_1_actions";
      const reason =
        command.type === "decide_double_attack_phase2"
          ? "Double Attack phase 2 cancelled"
          : command.type === "back_out_phase_attack" ||
              command.type === "submit_phase_initiative_choice"
            ? "Attack backed out"
            : stringFact(command.facts, "reason");
      const attackPhaseDefensivePenalty = combatAttackPhaseDefensivePenaltySchema.safeParse(
        command.facts.attackPhaseDefensivePenalty,
      );
      const penaltyConsequences = attackPhaseDefensivePenalty.success
        ? buildCombatAttackPhasePenaltyResultConsequences(attackPhaseDefensivePenalty.data)
        : undefined;
      return [
        make(
          {
            actorParticipantId: command.participantId,
            facts: {
              involvedOutcome: {
                reason,
                resolutionType: "skipped",
              },
              resultPresentation: {
                actionInstanceId:
                  (attackPhaseDefensivePenalty.success
                    ? attackPhaseDefensivePenalty.data.attackProcessId
                    : undefined) ?? command.id,
                calculationReferences: [],
                committedConsequences: penaltyConsequences?.committedConsequences ?? [],
                conciseOutcome: { details: ["No action"], label: "Skipped" },
                privateDiagnostics: [],
                standardConsequences: penaltyConsequences?.standardConsequences ?? [],
                subordinateEventReferences: [],
              },
            },
            involvedParticipantIds: [command.participantId],
            occurredAt: command.createdAt,
            ownerParticipantId: command.participantId,
            outcomeScope: "involved",
            phase: command.phase,
            sourceIds: [command.id],
            sourceKind: "legacy_command",
            status: "skipped",
            step,
            type: "action_skipped",
          },
          5,
        ),
      ];
    }

    if (
      command.type === "complete_damage_review_phase1" ||
      command.type === "complete_damage_review_phase2"
    ) {
      const step =
        command.type === "complete_damage_review_phase1" ? "phase_1_damage" : "phase_2_damage";
      return [
        make(
          {
            actorParticipantId: command.participantId,
            attackResultId: stringFact(command.facts, "attackResultId"),
            attackerParticipantId: stringFact(command.facts, "attackerParticipantId"),
            defenderParticipantId:
              stringFact(command.facts, "defenderParticipantId") ?? command.participantId,
            facts: {
              involvedOutcome: {
                resolutionType: "review_completed",
                status: stringFact(command.facts, "status"),
              },
              resultPresentation: {
                actionInstanceId: command.id,
                calculationReferences: [],
                committedConsequences: [],
                conciseOutcome: {
                  details: ["Review completed"],
                  label: "Damage/effects review",
                },
                privateDiagnostics: [],
                standardConsequences: [],
                subordinateEventReferences: [],
              },
            },
            involvedParticipantIds: unique([
              command.participantId,
              stringFact(command.facts, "attackerParticipantId"),
              stringFact(command.facts, "defenderParticipantId"),
            ]),
            occurredAt: command.createdAt,
            ownerParticipantId: command.participantId,
            outcomeScope: "involved",
            phase: command.phase,
            sourceIds: [command.id],
            sourceKind: "legacy_command",
            status: "committed",
            step,
            type: "effect_review",
          },
          9,
        ),
      ];
    }

    if (command.type === "complete_round" || command.type === "advance_combat_boundary") {
      return [
        make(
          {
            actorParticipantId: command.participantId,
            facts: {
              involvedOutcome: {
                resolutionType:
                  command.type === "complete_round" ? "round_completed" : "boundary_advanced",
              },
              resultPresentation: {
                actionInstanceId: command.id,
                calculationReferences: [],
                committedConsequences: [],
                conciseOutcome: {
                  details: [
                    command.type === "complete_round"
                      ? `Round ${command.roundNumber} completed`
                      : "Combat boundary advanced",
                  ],
                  label: "Round boundary",
                },
                privateDiagnostics: [],
                standardConsequences: [],
                subordinateEventReferences: [],
              },
            },
            involvedParticipantIds: [command.participantId],
            occurredAt: command.createdAt,
            ownerParticipantId: command.participantId,
            outcomeScope: "public",
            sourceIds: [command.id],
            sourceKind: "legacy_command",
            status: "committed",
            step: "round_summary",
            type: "round_boundary",
          },
          14,
        ),
      ];
    }

    return [];
  });
}

function snapshotFallbackCandidates(input: {
  encounterId: string;
  existingTypesByOwnerStep: Set<string>;
  roundNumber: number;
  snapshots: Array<{ sourceIndex: number; value: CombatRoundStepSnapshot }>;
}): LegacyEventCandidate[] {
  return input.snapshots.flatMap(({ sourceIndex, value: snapshot }) => {
    const key = `${snapshot.participantId}:${snapshot.step}`;
    if (input.existingTypesByOwnerStep.has(key) || !snapshot.actionResultSummary) return [];
    const type: CombatStepEventType | undefined =
      snapshot.step === "initiative_phase_1" || snapshot.step === "initiative_phase_2"
        ? snapshot.initiativeResult
          ? "initiative"
          : undefined
        : snapshot.step === "phase_1_actions" || snapshot.step === "phase_2_actions"
          ? "attack"
          : snapshot.step === "phase_1_damage" || snapshot.step === "phase_2_damage"
            ? snapshot.phaseResolutionResult?.damageProposal.status === "committed"
              ? "damage_committed"
              : "damage_proposed"
            : snapshot.step === "round_summary"
              ? "participant_su_review"
              : undefined;
    if (!type) return [];

    return [
      buildCandidate({
        encounterId: input.encounterId,
        event: {
          actorParticipantId: snapshot.participantId,
          completenessMissing: ["source.structuredFacts"],
          facts: {},
          occurredAt: snapshot.committedAt,
          ownerParticipantId: snapshot.participantId,
          phase: snapshot.phase,
          sourceIds: [snapshot.id],
          sourceKind: "legacy_snapshot",
          status: snapshot.actionResultStatus === "skipped" ? "skipped" : "recorded",
          step: snapshot.step,
          type,
        },
        roundNumber: input.roundNumber,
        sourceIndex,
        sourceRank: 13,
        sourceToken: snapshot.id,
      }),
    ];
  });
}

function orphanCommandCandidates(input: {
  candidates: LegacyEventCandidate[];
  commands: Array<{ sourceIndex: number; value: CombatRoundCommand }>;
  encounterId: string;
  roundNumber: number;
}): LegacyEventCandidate[] {
  const representedCommandIds = new Set(
    input.candidates.flatMap(({ event }) => (event.commandId ? [event.commandId] : [])),
  );

  return input.commands.flatMap(({ sourceIndex, value: command }) => {
    if (representedCommandIds.has(command.id)) return [];
    const facts = command.facts;
    const phase = command.phase;
    const attackResultId = stringFact(facts, "attackResultId");
    const attackerParticipantId =
      stringFact(facts, "attackerParticipantId") ??
      (command.type === "roll_attack" ? command.participantId : undefined);
    const defenderParticipantId = stringFact(facts, "defenderParticipantId");
    const mappings: Partial<
      Record<
        CombatRoundCommandType,
        { status: CombatStepEventStatus; step: CombatRoundStep; type: CombatStepEventType }
      >
    > = {
      commit_phase_damage: {
        status: "committed",
        step: phase ? phaseStep(phase, "damage") : "phase_1_damage",
        type: "damage_committed",
      },
      commit_round_end_distance_control: {
        status: "committed",
        step: "round_summary",
        type: "distance_control_applied",
      },
      commit_round_end_participant_review: {
        status: "committed",
        step: "round_summary",
        type: "participant_su_review",
      },
      declare_action: { status: "recorded", step: "select_actions", type: "declaration" },
      roll_combat_experience: {
        status: "recorded",
        step: phase ? phaseStep(phase, "attack") : "select_actions",
        type: "combat_experience",
      },
      resolve_damage: {
        status: "proposed",
        step: phase ? phaseStep(phase, "damage") : "phase_1_damage",
        type: "damage_proposed",
      },
      roll_attack: {
        status: "recorded",
        step: phase ? phaseStep(phase, "attack") : "phase_1_actions",
        type: "attack",
      },
      roll_critical: {
        status: "recorded",
        step: phase ? phaseStep(phase, "damage") : "phase_1_damage",
        type: "critical",
      },
      roll_hit_location: {
        status: "recorded",
        step: phase ? phaseStep(phase, "damage") : "phase_1_damage",
        type: "hit_location",
      },
      roll_initiative_phase1: {
        status: "recorded",
        step: "initiative_phase_1",
        type: "initiative",
      },
      roll_initiative_phase2: {
        status: "recorded",
        step: "initiative_phase_2",
        type: "initiative",
      },
      roll_parry: {
        status: "recorded",
        step: phase ? phaseStep(phase, "parry") : "review_phase_2_actions",
        type: "parry",
      },
      roll_round_end_distance_control: {
        status: "recorded",
        step: "round_summary",
        type: "distance_control_roll",
      },
      roll_round_end_health_check: {
        status: "recorded",
        step: "round_summary",
        type: "health_check",
      },
    };
    const mapping = mappings[command.type];
    if (!mapping) return [];
    const combatExperience = mapping.type === "combat_experience";
    const rollerParticipantId = combatExperience
      ? command.participantId
      : stringFact(facts, "rolledByParticipantId");
    const combatExperienceFinalTotal = numberFact(facts, "finalTotal");
    const combatExperienceDifficulty = numberFact(facts, "difficulty");
    const combatExperienceThreatParticipantIds = combatExperience
      ? Array.isArray(facts.phaseCombatExperienceThreats)
        ? facts.phaseCombatExperienceThreats.flatMap((threat) => {
            if (typeof threat !== "object" || threat === null) return [];
            const attackerParticipantId = (threat as Record<string, unknown>).attackerParticipantId;
            return typeof attackerParticipantId === "string" ? [attackerParticipantId] : [];
          })
        : []
      : [];
    const ownerParticipantId =
      mapping.type === "parry" ||
      mapping.type === "hit_location" ||
      mapping.type === "critical" ||
      mapping.type === "damage_proposed" ||
      mapping.type === "damage_committed"
        ? (defenderParticipantId ?? command.participantId)
        : command.participantId;
    const requiredMissing =
      mapping.type === "attack" ||
      mapping.type === "parry" ||
      mapping.type === "hit_location" ||
      mapping.type === "critical" ||
      mapping.type === "damage_proposed" ||
      mapping.type === "damage_committed"
        ? unique([
            ...(attackResultId ? [] : ["attackResultId"]),
            ...(attackerParticipantId ? [] : ["attackerParticipantId"]),
            ...(defenderParticipantId ? [] : ["defenderParticipantId"]),
          ])
        : [];

    return [
      buildCandidate({
        command,
        commandIndex: sourceIndex,
        encounterId: input.encounterId,
        event: {
          actorParticipantId: attackerParticipantId ?? command.participantId,
          attackResultId,
          attackerParticipantId,
          completenessMissing: combatExperience
            ? unique([
                ...(combatExperienceFinalTotal === undefined
                  ? ["facts.rollerPrivate.finalTotal"]
                  : []),
                ...(combatExperienceDifficulty === undefined
                  ? ["facts.rollerPrivate.difficulty"]
                  : []),
              ])
            : [...requiredMissing, "source.structuredResult"],
          damageResultId: stringFact(facts, "damageResultId"),
          defenderParticipantId,
          distanceProposalId: stringFact(facts, "distanceProposalId"),
          facts: {
            gmReview: {
              additionalEffects: facts.additionalEffects,
              cancelledActions: facts.cancelledActions,
            },
            involvedOutcome: {
              appliedDistance: facts.appliedDistance,
              ...(combatExperience
                ? {
                    resultBand: facts.resultBand,
                    resultLabel: facts.resultLabel,
                    modifierValue: facts.modifierValue,
                    phaseAttackCancelled: facts.phaseAttackCancelled,
                  }
                : {}),
              grazing: booleanFact(facts, "grazing"),
              hit: booleanFact(facts, "hit"),
              status: facts.status,
              success: combatExperience
                ? combatExperienceFinalTotal !== undefined &&
                  combatExperienceDifficulty !== undefined
                  ? combatExperienceFinalTotal >= combatExperienceDifficulty
                  : undefined
                : booleanFact(facts, "success"),
            },
            rollerPrivate: {
              finalTotal: numberFact(facts, "finalTotal"),
              hitLocationRolls: facts.hitLocationRolls,
              openEndedD10s: facts.openEndedD10s,
              rollD20: numberFact(facts, "rollD20"),
              rollTotal: numberFact(facts, "rollTotal"),
              ...(combatExperience
                ? {
                    difficulty: combatExperienceDifficulty,
                    skillTotal: numberFact(facts, "skillTotal"),
                  }
                : {}),
            },
          },
          healthRollId: stringFact(facts, "healthRollId"),
          involvedParticipantIds: combatExperience
            ? [command.participantId, ...combatExperienceThreatParticipantIds]
            : undefined,
          occurredAt: command.createdAt,
          opportunityId: stringFact(facts, "opportunityId"),
          ownerParticipantId,
          phase,
          rollerParticipantId,
          sourceIds: [command.id],
          sourceKind: "legacy_command",
          status: mapping.status,
          step: mapping.step,
          targetParticipantId: defenderParticipantId ?? combatExperienceThreatParticipantIds[0],
          type: mapping.type,
        },
        roundNumber: input.roundNumber,
        sourceIndex,
        sourceRank: 14,
        sourceToken: command.id,
      }),
    ];
  });
}

function compareCandidates(left: LegacyEventCandidate, right: LegacyEventCandidate): number {
  const leftTimestamp = left.event.occurredAt;
  const rightTimestamp = right.event.occurredAt;
  if (leftTimestamp && rightTimestamp && leftTimestamp !== rightTimestamp) {
    return leftTimestamp.localeCompare(rightTimestamp);
  }
  if (leftTimestamp && !rightTimestamp) return -1;
  if (!leftTimestamp && rightTimestamp) return 1;
  const leftCommand = left.commandIndex ?? Number.MAX_SAFE_INTEGER;
  const rightCommand = right.commandIndex ?? Number.MAX_SAFE_INTEGER;
  return (
    leftCommand - rightCommand ||
    left.sourceRank - right.sourceRank ||
    left.sourceIndex - right.sourceIndex ||
    left.event.id.localeCompare(right.event.id)
  );
}

/**
 * Derives a read-only legacy event stream from immutable round facts. Persisted timestamps sort
 * first. Equal or absent timestamps fall back to command order, source kind/index, and stable ID.
 * Invalid source rows are ignored; partial valid rows become explicit incomplete events.
 */
export function deriveLegacyCombatStepEvents(
  input: DeriveLegacyCombatStepEventsInput,
): CombatStepEvent[] {
  if (!input.encounterId || !Number.isInteger(input.roundNumber) || input.roundNumber < 1) {
    return [];
  }
  const parsed = parseLegacyInputs(input);
  const candidates: LegacyEventCandidate[] = [];

  parsed.participants.forEach(({ sourceIndex, value: participant }) => {
    const declaration = declarationCandidate({
      commands: parsed.commands,
      encounterId: input.encounterId,
      participant,
      participantIndex: sourceIndex,
      roundNumber: input.roundNumber,
    });
    if (declaration) candidates.push(declaration);
    candidates.push(
      ...initiativeCandidates({
        commands: parsed.commands,
        encounterId: input.encounterId,
        participant,
        participantIndex: sourceIndex,
        roundNumber: input.roundNumber,
      }),
      ...attackCandidates({
        commands: parsed.commands,
        encounterId: input.encounterId,
        participant,
        participantIndex: sourceIndex,
        roundNumber: input.roundNumber,
      }),
    );
  });
  parsed.resolutions.forEach(({ sourceIndex, value: resolution }) => {
    candidates.push(
      ...resolutionCandidates({
        commands: parsed.commands,
        encounterId: input.encounterId,
        resolution,
        resolutionIndex: sourceIndex,
        roundNumber: input.roundNumber,
      }),
    );
  });
  candidates.push(
    ...distanceCandidates({
      commands: parsed.commands,
      encounterId: input.encounterId,
      roundEndReview: parsed.roundEndReview,
      roundNumber: input.roundNumber,
    }),
    ...roundEndParticipantCandidates({
      commands: parsed.commands,
      encounterId: input.encounterId,
      roundEndReview: parsed.roundEndReview,
      roundNumber: input.roundNumber,
    }),
    ...workflowCommandCandidates({
      commands: parsed.commands,
      encounterId: input.encounterId,
      roundNumber: input.roundNumber,
      snapshots: parsed.snapshots,
    }),
  );
  candidates.push(
    ...orphanCommandCandidates({
      candidates,
      commands: parsed.commands,
      encounterId: input.encounterId,
      roundNumber: input.roundNumber,
    }),
  );
  const existingTypesByOwnerStep = new Set(
    candidates.map(({ event }) => `${event.ownerParticipantId}:${event.step}`),
  );
  candidates.push(
    ...snapshotFallbackCandidates({
      encounterId: input.encounterId,
      existingTypesByOwnerStep,
      roundNumber: input.roundNumber,
      snapshots: parsed.snapshots,
    }),
  );

  return candidates
    .sort(compareCandidates)
    .map(({ event }, sequence) => combatStepEventSchema.parse({ ...event, sequence }));
}

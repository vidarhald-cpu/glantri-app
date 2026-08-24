import { deepFreeze } from "./internal";
import { projectPlayerSafeCombatAutomationEligibility } from "../combatAutomationEligibility";
import type {
  CombatantIdentity,
  CombatProgressionCanonicalOperationalPosition,
  CombatProgressionPresentationProjection,
  CombatProgressionPresentationTask,
  CombatProgressionProjection,
  CombatProgressionTask,
} from "./types";

export type CombatProgressionPresentationViewer =
  | { readonly kind: "gm" }
  | {
      readonly controlledParticipantIds: ReadonlySet<string>;
      readonly kind: "player";
      readonly visibleParticipantIds: ReadonlySet<string>;
    };

function visibleIdentity(
  identity: CombatantIdentity | undefined,
  viewer: CombatProgressionPresentationViewer,
): CombatantIdentity | undefined {
  if (!identity) return undefined;
  return viewer.kind === "gm" || viewer.visibleParticipantIds.has(identity.participantId)
    ? identity
    : undefined;
}

function taskIsVisible(
  task: CombatProgressionTask,
  viewer: CombatProgressionPresentationViewer,
): boolean {
  if (viewer.kind === "gm") return true;

  if (task.kind === "gm_advance_boundary" || task.kind === "defense_review") return false;

  const attackParticipantIds = [
    task.identity.attackerParticipantId,
    task.identity.defenderParticipantId,
  ].filter((participantId): participantId is string => participantId !== undefined);
  if (
    attackParticipantIds.length > 0 &&
    attackParticipantIds.some(
      (participantId) => !viewer.visibleParticipantIds.has(participantId),
    ) &&
    !attackParticipantIds.some((participantId) =>
      viewer.controlledParticipantIds.has(participantId),
    )
  ) {
    return false;
  }

  const owner = task.owner?.kind === "combatant" ? task.owner : undefined;
  const facetOwner = task.trackerFacet.owner;
  // Optional GM declaration edits are capabilities, not player-visible progression work.
  if (task.kind === "submit_declaration" && !task.allowedActors.includes("combatant")) {
    return false;
  }
  if (!facetOwner) {
    // The resolved Adjust Distance commit is intentionally process-owned rather than attached to
    // either participant's tracker row. Both involved participants still need its safe situation
    // and completion state so their Current Action can say that the GM is resolving the contest.
    if (task.kind !== "adjust_distance_commit" && task.kind !== "damage_review") return false;
    return [task.presentationContext?.actor, task.presentationContext?.target].some(
      (identity) =>
        identity !== undefined && viewer.controlledParticipantIds.has(identity.participantId),
    );
  }
  if (facetOwner && !viewer.visibleParticipantIds.has(facetOwner.participantId)) return false;

  // Initiative choices and later private participant workflows remain visible only to their owner.
  if (
    task.expectedCommand === "submit_phase_initiative_choice" ||
    task.kind === "combat_experience" ||
    task.kind === "health_review" ||
    task.kind === "observation_roll"
  ) {
    return Boolean(owner && viewer.controlledParticipantIds.has(owner.participantId));
  }
  return true;
}

function contributesToProgression(task: CombatProgressionTask): boolean {
  return !(
    task.kind === "submit_declaration" &&
    !task.allowedActors.includes("combatant") &&
    task.owner?.kind === "combatant"
  );
}

function presentationTask(task: CombatProgressionTask): CombatProgressionPresentationTask {
  const combatantMayAct = task.allowedActors.includes("combatant");
  return {
    actorAccess: {
      combatant: combatantMayAct,
      gm: task.allowedActors.includes("gm"),
    },
    automation: {
      ...task.automation,
      authority: {
        kind: task.automation.authority.kind,
        participantId: task.automation.authority.participantId,
      },
    },
    // A submitted declaration remains GM-editable, but that optional edit is not blocking work.
    contributesToProgression: contributesToProgression(task),
    executionGroupId: task.executionGroupId,
    expectedCommand: task.expectedCommand,
    id: task.id,
    identity: task.identity,
    kind: task.kind,
    opponent: task.opponent,
    owner: task.owner,
    presentationContext: task.presentationContext,
    processId: task.processId,
    stageId: task.stageId,
    state: task.state,
    trackerFacet: task.trackerFacet,
    transition: task.transition,
  };
}

function visibleAutomation(
  task: CombatProgressionPresentationTask,
  viewer: CombatProgressionPresentationViewer,
): CombatProgressionPresentationTask["automation"] {
  if (viewer.kind === "gm") return task.automation;
  return projectPlayerSafeCombatAutomationEligibility({
    controlledParticipantIds: viewer.controlledParticipantIds,
    fact: task.automation,
  });
}

function hidesAttackLineage(
  task: CombatProgressionPresentationTask,
  viewer: CombatProgressionPresentationViewer,
): boolean {
  return (
    viewer.kind === "player" &&
    [task.identity.attackerParticipantId, task.identity.defenderParticipantId].some(
      (participantId) =>
        participantId !== undefined && !viewer.visibleParticipantIds.has(participantId),
    )
  );
}

function mayReceiveCanonicalAttackIdentity(input: {
  canonicalTaskId: string | undefined;
  task: CombatProgressionTask;
  viewer: CombatProgressionPresentationViewer;
}): boolean {
  if (input.viewer.kind === "gm") return true;
  if (
    input.task.kind !== "attack" ||
    input.task.id !== input.canonicalTaskId ||
    input.task.state !== "executable" ||
    input.task.expectedCommand !== "roll_attack" ||
    !input.task.allowedActors.includes("combatant") ||
    input.task.owner?.kind !== "combatant" ||
    !input.viewer.controlledParticipantIds.has(input.task.owner.participantId)
  ) {
    return false;
  }
  const attackerParticipantId = input.task.identity.attackerParticipantId;
  return Boolean(
    attackerParticipantId && input.viewer.controlledParticipantIds.has(attackerParticipantId),
  );
}

function visibleTaskIdentity(
  task: CombatProgressionPresentationTask,
  viewer: CombatProgressionPresentationViewer,
  executionGroupId = task.identity.executionGroupId,
  mayReceiveAttackIdentity = true,
): CombatProgressionPresentationTask["identity"] {
  if (viewer.kind === "gm") return task.identity;
  const participantVisible = (participantId: string | undefined) =>
    participantId !== undefined && viewer.visibleParticipantIds.has(participantId);
  const attackLineageVisible = [
    task.identity.attackerParticipantId,
    task.identity.defenderParticipantId,
  ].every((participantId) => participantId === undefined || participantVisible(participantId));
  if (!attackLineageVisible) {
    return {
      actionId: task.identity.actionId,
      attackIndex: task.identity.attackIndex,
      defenderParticipantId: participantVisible(task.identity.defenderParticipantId)
        ? task.identity.defenderParticipantId
        : undefined,
      executionGroupId,
      parryPurpose: task.identity.parryPurpose,
      participantId: participantVisible(task.identity.participantId)
        ? task.identity.participantId
        : undefined,
      phase: task.identity.phase,
    };
  }
  if (task.kind === "attack" && !mayReceiveAttackIdentity) {
    return {
      attackerParticipantId: participantVisible(task.identity.attackerParticipantId)
        ? task.identity.attackerParticipantId
        : undefined,
      defenderParticipantId: participantVisible(task.identity.defenderParticipantId)
        ? task.identity.defenderParticipantId
        : undefined,
      executionGroupId,
      participantId: participantVisible(task.identity.participantId)
        ? task.identity.participantId
        : undefined,
      phase: task.identity.phase,
    };
  }
  return {
    actionId: task.identity.actionId,
    attackIndex: task.identity.attackIndex,
    attackModeId: task.identity.attackModeId,
    attackResultId: attackLineageVisible ? task.identity.attackResultId : undefined,
    attackerParticipantId: participantVisible(task.identity.attackerParticipantId)
      ? task.identity.attackerParticipantId
      : undefined,
    contestId: task.identity.contestId,
    criticalResultId: task.identity.criticalResultId,
    damageRollExpression: task.identity.damageRollExpression,
    damageReviewId: task.identity.damageReviewId,
    declarationId: task.identity.declarationId,
    declaredOpponentParticipantId: participantVisible(task.identity.declaredOpponentParticipantId)
      ? task.identity.declaredOpponentParticipantId
      : undefined,
    defenderParticipantId: participantVisible(task.identity.defenderParticipantId)
      ? task.identity.defenderParticipantId
      : undefined,
    disarmAttemptId: task.identity.disarmAttemptId,
    executionGroupId,
    healthRollId: task.identity.healthRollId,
    hitLocationResultId: task.identity.hitLocationResultId,
    initiativeGroupId: task.kind === "attack" ? task.identity.initiativeGroupId : undefined,
    initiativeValue: task.kind === "attack" ? task.identity.initiativeValue : undefined,
    opportunityId: attackLineageVisible ? task.identity.opportunityId : undefined,
    offensiveParryAttemptId: task.identity.offensiveParryAttemptId,
    observationAttemptId: task.identity.observationAttemptId,
    opponentParticipantId: participantVisible(task.identity.opponentParticipantId)
      ? task.identity.opponentParticipantId
      : undefined,
    parryPurpose: task.identity.parryPurpose,
    parryResultId: task.identity.parryResultId,
    parrySourceId: task.identity.parrySourceId,
    pairId:
      participantVisible(task.identity.participantId) &&
      participantVisible(task.identity.opponentParticipantId)
        ? task.identity.pairId
        : undefined,
    participantId: participantVisible(task.identity.participantId)
      ? task.identity.participantId
      : undefined,
    phase: task.identity.phase,
    proposalId: task.identity.proposalId,
    relationshipId: task.identity.relationshipId,
    weaponInstanceId: task.identity.weaponInstanceId,
    weaponSourceId: task.identity.weaponSourceId,
    weaponSourceSlot: task.identity.weaponSourceSlot,
    weaponTemplateId: task.identity.weaponTemplateId,
  };
}

function hasRelevantConflict(
  projection: CombatProgressionProjection,
  visibleTaskIds: ReadonlySet<string>,
): boolean {
  return projection.diagnostics.some((diagnostic) => {
    if (
      diagnostic.code !== "multiple_executable_tasks" &&
      diagnostic.code !== "missing_owner" &&
      diagnostic.code !== "cursor_disagrees_with_process"
    ) {
      return false;
    }
    return (
      diagnostic.relatedIds.length === 0 ||
      diagnostic.relatedIds.some(
        (id) =>
          visibleTaskIds.has(id) ||
          id === projection.boundary.id ||
          projection.boundary.processes.some(
            (process) => process.id === id || process.stages.some((stage) => stage.id === id),
          ),
      )
    );
  });
}

function isInternalDeterministicTask(task: CombatProgressionTask): boolean {
  return Boolean(
    task.participation?.status === "required" &&
    task.participation.workClass === "deterministic_transition" &&
    task.participation.completeness === "complete",
  );
}

function canonicalOperationalTask(projection: CombatProgressionProjection):
  | {
      executionStrategy: CombatProgressionCanonicalOperationalPosition["executionStrategy"];
      task: CombatProgressionTask;
    }
  | undefined {
  for (const process of projection.boundary.processes) {
    for (const stage of process.stages) {
      if (stage.state !== "active") continue;
      for (const group of stage.executionGroups) {
        if (group.completionState === "complete") continue;
        const tasks = group.tasks.filter(
          (task) => !isInternalDeterministicTask(task) && contributesToProgression(task),
        );
        const task = tasks.find((candidate) => candidate.state === "executable") ?? tasks[0];
        if (task) return { executionStrategy: group.executionStrategy, task };
      }
    }
  }
  return undefined;
}

function waitingFor(
  task: CombatProgressionTask | undefined,
): CombatProgressionCanonicalOperationalPosition["waitingFor"] {
  if (!task) return "unknown";
  if (task.allowedActors.length === 1 && task.allowedActors[0] === "gm") return "gm";
  if (task.owner?.kind === "combatant" || task.allowedActors.includes("combatant")) {
    return "combatant";
  }
  return task.allowedActors.includes("gm") ? "gm" : "unknown";
}

/** Removes private authorization, blocker, diagnostic, proposal contents, and calculations. */
export function projectCombatProgressionPresentation(input: {
  projection: CombatProgressionProjection;
  viewer: CombatProgressionPresentationViewer;
}): CombatProgressionPresentationProjection {
  const canonical = canonicalOperationalTask(input.projection);
  const presentedByCanonicalTaskId = new Map<string, CombatProgressionPresentationTask>();
  const processes = input.projection.boundary.processes.flatMap((process, processIndex) => {
    const projectedProcessId =
      input.viewer.kind === "player"
        ? `player:round:${input.projection.roundNumber}:process:${processIndex}`
        : process.id;
    const stages = process.stages.flatMap((stage, stageIndex) => {
      const projectedStageId =
        input.viewer.kind === "player" ? `${projectedProcessId}:stage:${stageIndex}` : stage.id;
      const executionGroups = stage.executionGroups.flatMap((group, groupIndex) => {
        const projectedGroupId =
          input.viewer.kind === "player" ? `${projectedStageId}:group:${groupIndex}` : group.id;
        const tasks = group.tasks
          .filter((task) => taskIsVisible(task, input.viewer) && !isInternalDeterministicTask(task))
          .map(presentationTask)
          .map((task, taskIndex) => {
            const hiddenLineage = hidesAttackLineage(task, input.viewer);
            const canonicalSourceTask = group.tasks.find((candidate) => candidate.id === task.id);
            const mayReceiveAttackIdentity = canonicalSourceTask
              ? mayReceiveCanonicalAttackIdentity({
                  canonicalTaskId: canonical?.task.id,
                  task: canonicalSourceTask,
                  viewer: input.viewer,
                })
              : false;
            const restrictedAttackLineage = task.kind === "attack" && !mayReceiveAttackIdentity;
            const redactExecutableLineage = hiddenLineage || restrictedAttackLineage;
            const taskId = redactExecutableLineage
              ? `${projectedGroupId}:task:${taskIndex}`
              : task.id;
            const executionGroupId = redactExecutableLineage
              ? projectedGroupId
              : task.executionGroupId;
            const automation = visibleAutomation(task, input.viewer);
            const presented: CombatProgressionPresentationTask = {
              ...task,
              actorAccess: redactExecutableLineage
                ? { combatant: false, gm: task.actorAccess.gm }
                : task.actorAccess,
              automation: redactExecutableLineage
                ? {
                    ...automation,
                    ...(hiddenLineage
                      ? {
                          eligibility: "not_allowed" as const,
                          stopReason: "hidden_information" as const,
                        }
                      : undefined),
                    taskId,
                  }
                : automation,
              executionGroupId,
              id: taskId,
              identity: visibleTaskIdentity(
                task,
                input.viewer,
                executionGroupId,
                mayReceiveAttackIdentity,
              ),
              owner:
                task.owner?.kind === "combatant"
                  ? visibleIdentity(task.owner, input.viewer)
                  : task.owner,
              opponent: visibleIdentity(task.opponent, input.viewer),
              presentationContext: task.presentationContext
                ? {
                    ...(redactExecutableLineage
                      ? {
                          actionKind: task.presentationContext.actionKind,
                          attackOutcome: task.presentationContext.attackOutcome,
                          damageRollExpression: task.presentationContext.damageRollExpression,
                        }
                      : task.presentationContext),
                    actor: visibleIdentity(task.presentationContext.actor, input.viewer),
                    responder: visibleIdentity(task.presentationContext.responder, input.viewer),
                    target: visibleIdentity(task.presentationContext.target, input.viewer),
                    weapon: redactExecutableLineage ? undefined : task.presentationContext.weapon,
                  }
                : undefined,
              processId: redactExecutableLineage ? projectedProcessId : task.processId,
              stageId: redactExecutableLineage ? projectedStageId : task.stageId,
              trackerFacet: {
                ...task.trackerFacet,
                owner: visibleIdentity(task.trackerFacet.owner, input.viewer),
              },
              transition: redactExecutableLineage ? undefined : task.transition,
            };
            presentedByCanonicalTaskId.set(task.id, presented);
            return presented;
          });
        if (input.viewer.kind === "player" && tasks.length === 0) return [];
        return [
          {
            activationBoundary: group.activationBoundary,
            blocked: group.blockerIds.length > 0,
            completionState: group.completionState,
            executionStrategy: group.executionStrategy,
            futureActivationBoundary: group.futureActivationBoundary,
            id: tasks.some((task) => task.executionGroupId === projectedGroupId)
              ? projectedGroupId
              : group.id,
            position: group.position,
            stageId: tasks.some((task) => task.stageId === projectedStageId)
              ? projectedStageId
              : group.stageId,
            tasks,
          },
        ];
      });
      const tasks = executionGroups.flatMap((group) => group.tasks);
      if (input.viewer.kind === "player" && tasks.length === 0) return [];
      return [
        {
          executionGroups,
          executionStrategy: stage.executionStrategy,
          id: tasks.some((task) => task.stageId === projectedStageId) ? projectedStageId : stage.id,
          kind: stage.kind,
          processId: tasks.some((task) => task.processId === projectedProcessId)
            ? projectedProcessId
            : stage.processId,
          state: stage.state,
          tasks,
        },
      ];
    });
    if (input.viewer.kind === "player" && stages.length === 0) return [];
    return [
      {
        id: stages.some((stage) => stage.processId === projectedProcessId)
          ? projectedProcessId
          : process.id,
        kind: process.kind,
        stages,
      },
    ];
  });
  const visibleTaskIds = new Set(
    processes.flatMap((process) =>
      process.stages.flatMap((stage) =>
        stage.executionGroups.flatMap((group) => group.tasks.map((task) => task.id)),
      ),
    ),
  );
  const canonicalTask = canonical ? presentedByCanonicalTaskId.get(canonical.task.id) : undefined;
  const canonicalGroupVisible = Boolean(
    canonical &&
    processes.some((process) =>
      process.stages.some((stage) =>
        stage.executionGroups.some((group) => group.tasks.some((task) => task === canonicalTask)),
      ),
    ),
  );
  const canonicalStageVisible = Boolean(
    canonical &&
    processes.some((process) =>
      process.stages.some((stage) => stage.tasks.some((task) => task === canonicalTask)),
    ),
  );
  const visibleParticipantIds =
    input.viewer.kind === "player" ? input.viewer.visibleParticipantIds : undefined;
  const executionOrder = input.projection.executionOrder
    ? {
        ...input.projection.executionOrder,
        initiativeGroups: input.projection.executionOrder.initiativeGroups?.map((group) => ({
          ...group,
          opportunityIds: input.viewer.kind === "gm" ? group.opportunityIds : [],
          participantIds: !visibleParticipantIds
            ? group.participantIds
            : group.participantIds.filter((participantId) =>
                visibleParticipantIds.has(participantId),
              ),
        })),
        participantIds: !visibleParticipantIds
          ? input.projection.executionOrder.participantIds
          : input.projection.executionOrder.participantIds.filter((participantId) =>
              visibleParticipantIds.has(participantId),
            ),
      }
    : undefined;
  const awaitingGmTransition = input.projection.boundary.processes.some((process) =>
    process.stages.some((stage) =>
      stage.executionGroups.some((group) =>
        group.tasks.some(
          (task) =>
            task.kind === "gm_advance_boundary" &&
            !isInternalDeterministicTask(task) &&
            task.state === "executable" &&
            task.allowedActors.length === 1 &&
            task.allowedActors[0] === "gm",
        ),
      ),
    ),
  );

  return deepFreeze({
    awaitingGmTransition,
    boundary: {
      id: input.projection.boundary.id,
      kind: input.projection.boundary.kind,
      roundNumber: input.projection.boundary.roundNumber,
    },
    canonicalOperationalPosition: {
      executionGroupId: canonicalGroupVisible ? canonicalTask?.executionGroupId : undefined,
      executionStrategy: canonical?.executionStrategy,
      processId: canonicalStageVisible ? canonicalTask?.processId : undefined,
      roundNumber: input.projection.roundNumber,
      stageId: canonicalStageVisible ? canonicalTask?.stageId : undefined,
      task: canonicalTask,
      taskVisibility: canonicalTask ? "visible" : canonical ? "redacted" : "unavailable",
      trackerFacet: {
        owner: canonicalTask?.trackerFacet.owner,
        step:
          canonical?.task.trackerFacet.step ??
          (
            {
              declaration: "DE",
              phase1_modifier_review: "M1",
              phase1_initiative: "i1",
              phase1_resolution: "A1",
              phase2_modifier_review: "M2",
              phase2_initiative: "i2",
              phase2_resolution: "A2",
              round_end: "SU",
              round_boundary: "SU",
            } as const
          )[input.projection.boundary.kind],
      },
      waitingFor: waitingFor(canonical?.task),
    },
    executionOrder,
    processes,
    roundNumber: input.projection.roundNumber,
    taskVisibility: hasRelevantConflict(input.projection, visibleTaskIds)
      ? "conflicted"
      : "available",
  });
}

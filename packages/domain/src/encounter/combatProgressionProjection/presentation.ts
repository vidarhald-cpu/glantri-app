import { deepFreeze } from "./internal";
import type {
  CombatantIdentity,
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

  if (task.kind === "gm_advance_boundary") return false;

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
    task.kind === "health_review"
  ) {
    return Boolean(owner && viewer.controlledParticipantIds.has(owner.participantId));
  }
  return true;
}

function presentationTask(task: CombatProgressionTask): CombatProgressionPresentationTask {
  const combatantMayAct = task.allowedActors.includes("combatant");
  return {
    actorAccess: {
      combatant: combatantMayAct,
      gm: task.allowedActors.includes("gm"),
    },
    // A submitted declaration remains GM-editable, but that optional edit is not blocking work.
    contributesToProgression: !(
      task.kind === "submit_declaration" &&
      !combatantMayAct &&
      task.owner?.kind === "combatant"
    ),
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

function visibleTaskIdentity(
  task: CombatProgressionPresentationTask,
  viewer: CombatProgressionPresentationViewer,
): CombatProgressionPresentationTask["identity"] {
  if (viewer.kind === "gm") return task.identity;
  const participantVisible = (participantId: string | undefined) =>
    participantId !== undefined && viewer.visibleParticipantIds.has(participantId);
  return {
    actionId: task.identity.actionId,
    attackIndex: task.identity.attackIndex,
    attackModeId: task.identity.attackModeId,
    attackResultId: task.identity.attackResultId,
    attackerParticipantId: participantVisible(task.identity.attackerParticipantId)
      ? task.identity.attackerParticipantId
      : undefined,
    criticalResultId: task.identity.criticalResultId,
    damageRollExpression: task.identity.damageRollExpression,
    damageReviewId: task.identity.damageReviewId,
    declarationId: task.identity.declarationId,
    defenderParticipantId: participantVisible(task.identity.defenderParticipantId)
      ? task.identity.defenderParticipantId
      : undefined,
    executionGroupId: task.identity.executionGroupId,
    healthRollId: task.identity.healthRollId,
    hitLocationResultId: task.identity.hitLocationResultId,
    opportunityId: task.identity.opportunityId,
    opponentParticipantId: participantVisible(task.identity.opponentParticipantId)
      ? task.identity.opponentParticipantId
      : undefined,
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

/** Removes private authorization, blocker, diagnostic, proposal contents, and calculations. */
export function projectCombatProgressionPresentation(input: {
  projection: CombatProgressionProjection;
  viewer: CombatProgressionPresentationViewer;
}): CombatProgressionPresentationProjection {
  const processes = input.projection.boundary.processes.flatMap((process) => {
    const stages = process.stages.flatMap((stage) => {
      const executionGroups = stage.executionGroups.flatMap((group) => {
        const tasks = group.tasks
          .filter((task) => taskIsVisible(task, input.viewer))
          .map(presentationTask)
          .map((task) => ({
            ...task,
            identity: visibleTaskIdentity(task, input.viewer),
            owner:
              task.owner?.kind === "combatant"
                ? visibleIdentity(task.owner, input.viewer)
                : task.owner,
            opponent: visibleIdentity(task.opponent, input.viewer),
            presentationContext: task.presentationContext
              ? {
                  ...task.presentationContext,
                  actor: visibleIdentity(task.presentationContext.actor, input.viewer),
                  responder: visibleIdentity(task.presentationContext.responder, input.viewer),
                  target: visibleIdentity(task.presentationContext.target, input.viewer),
                }
              : undefined,
            trackerFacet: {
              ...task.trackerFacet,
              owner: visibleIdentity(task.trackerFacet.owner, input.viewer),
            },
          }));
        if (input.viewer.kind === "player" && tasks.length === 0) return [];
        return [
          {
            activationBoundary: group.activationBoundary,
            blocked: group.blockerIds.length > 0,
            completionState: group.completionState,
            executionStrategy: group.executionStrategy,
            futureActivationBoundary: group.futureActivationBoundary,
            id: group.id,
            position: group.position,
            stageId: group.stageId,
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
          id: stage.id,
          kind: stage.kind,
          processId: stage.processId,
          state: stage.state,
          tasks,
        },
      ];
    });
    if (input.viewer.kind === "player" && stages.length === 0) return [];
    return [{ id: process.id, kind: process.kind, stages }];
  });
  const visibleTaskIds = new Set(
    processes.flatMap((process) =>
      process.stages.flatMap((stage) =>
        stage.executionGroups.flatMap((group) => group.tasks.map((task) => task.id)),
      ),
    ),
  );
  const visibleParticipantIds =
    input.viewer.kind === "player" ? input.viewer.visibleParticipantIds : undefined;
  const executionOrder = input.projection.executionOrder
    ? {
        ...input.projection.executionOrder,
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
    executionOrder,
    processes,
    roundNumber: input.projection.roundNumber,
    taskVisibility: hasRelevantConflict(input.projection, visibleTaskIds)
      ? "conflicted"
      : "available",
  });
}

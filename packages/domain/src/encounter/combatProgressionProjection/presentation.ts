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
  if (!facetOwner) return false;
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
    id: task.id,
    identity: {
      executionGroupId: task.identity.executionGroupId,
      phase: task.identity.phase,
    },
    kind: task.kind,
    owner: task.owner,
    processId: task.processId,
    stageId: task.stageId,
    state: task.state,
    trackerFacet: task.trackerFacet,
    transition: task.transition,
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

/** Removes authorization, blocker, diagnostic, command, proposal, and calculation details. */
export function projectCombatProgressionPresentation(input: {
  projection: CombatProgressionProjection;
  viewer: CombatProgressionPresentationViewer;
}): CombatProgressionPresentationProjection {
  const processes = input.projection.boundary.processes.flatMap((process) => {
    const stages = process.stages.flatMap((stage) => {
      const tasks = stage.tasks
        .filter((task) => taskIsVisible(task, input.viewer))
        .map(presentationTask)
        .map((task) => ({
          ...task,
          owner:
            task.owner?.kind === "combatant"
              ? visibleIdentity(task.owner, input.viewer)
              : task.owner,
          trackerFacet: {
            ...task.trackerFacet,
            owner: visibleIdentity(task.trackerFacet.owner, input.viewer),
          },
        }));
      if (input.viewer.kind === "player" && tasks.length === 0) return [];
      return [{ ...stage, tasks }];
    });
    if (input.viewer.kind === "player" && stages.length === 0) return [];
    return [{ id: process.id, kind: process.kind, stages }];
  });
  const visibleTaskIds = new Set(
    processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.tasks.map((task) => task.id)),
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
      stage.tasks.some(
        (task) =>
          task.kind === "gm_advance_boundary" &&
          task.state === "executable" &&
          task.allowedActors.length === 1 &&
          task.allowedActors[0] === "gm",
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

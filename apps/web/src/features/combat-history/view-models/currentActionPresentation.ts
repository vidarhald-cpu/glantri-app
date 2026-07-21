import type {
  CombatProgressionBoundaryKind,
  CombatProgressionExpectedCommand,
  CombatProgressionPresentationProjection,
  CombatProgressionPresentationTask,
  CombatProgressionTaskKind,
  CombatRoundPhase,
} from "@glantri/domain";

export interface CombatPresentationSubject {
  readonly hidden: boolean;
  readonly id?: string;
  readonly label: string;
}

export interface CombatPresentationReference {
  readonly id?: string;
  readonly label: string;
}

export interface CurrentActionCommandDescriptor {
  readonly attackResultId?: string;
  readonly commandType: CombatProgressionExpectedCommand;
  readonly encounterId: string;
  readonly expectedBoundary: CombatProgressionBoundaryKind;
  readonly expectedRevision: string;
  readonly healthRollId?: string;
  readonly opponentParticipantId?: string;
  readonly opportunityId?: string;
  readonly pairId?: string;
  readonly participantId?: string;
  readonly phase?: CombatRoundPhase;
  readonly proposalId?: string;
  readonly targetBoundary?: CombatProgressionBoundaryKind;
  readonly taskId: string;
}

export interface CurrentActionPresentation {
  readonly actionKind?: string;
  readonly actionName: string;
  readonly actor?: CombatPresentationSubject;
  readonly boundary: CombatProgressionBoundaryKind;
  readonly encounterId: string;
  readonly encounterRevision: string;
  readonly executionGroupId?: string;
  readonly expectedNextProcess?: { readonly label: string; readonly processId?: string };
  readonly heading: string;
  readonly difficulty?: number;
  readonly phase?: CombatRoundPhase;
  readonly primaryAction: {
    readonly descriptor?: CurrentActionCommandDescriptor;
    readonly enabled: boolean;
    readonly gmProxyAvailable: boolean;
    readonly label: string;
    readonly viewerMayInvoke: boolean;
  };
  readonly processId?: string;
  readonly reason: string;
  readonly requiredActor: CombatPresentationSubject;
  readonly requiredNow: string;
  readonly skill?: CombatPresentationReference;
  readonly stageId?: string;
  readonly status: "awaiting_gm" | "conflicted" | "executable" | "waiting";
  readonly summary: string;
  readonly target?: CombatPresentationSubject;
  readonly taskHeading: string;
  readonly taskId?: string;
  readonly taskKind?: CombatProgressionTaskKind;
  readonly trackerFacet?: string;
  readonly weapon?: CombatPresentationReference;
  readonly distance?: {
    readonly current?: number;
    readonly direction?: string;
    readonly requested?: number;
  };
}

export interface CurrentActionViewerContext {
  readonly controlledParticipantIds?: ReadonlySet<string>;
  readonly kind: "gm" | "player";
  readonly mayProxy?: boolean;
}

export interface BuildCurrentActionPresentationInput {
  readonly encounterId: string;
  readonly encounterRevision?: string;
  readonly progression?: CombatProgressionPresentationProjection;
  readonly viewer: CurrentActionViewerContext;
}

/**
 * Labels an already-authorized declaration command as an edit only when its immutable descriptor
 * belongs to the inspected participant. This never creates or retargets an action.
 */
export function labelCurrentActionAsDeclarationEdit(input: {
  readonly participantId?: string;
  readonly presentation?: CurrentActionPresentation | null;
}): CurrentActionPresentation | null | undefined {
  const presentation = input.presentation;
  if (
    !presentation ||
    presentation.taskKind !== "submit_declaration" ||
    !input.participantId ||
    presentation.primaryAction.descriptor?.participantId !== input.participantId
  ) {
    return presentation;
  }
  return Object.freeze({
    ...presentation,
    primaryAction: Object.freeze({
      ...presentation.primaryAction,
      label: "Update declaration",
    }),
    requiredNow: "Update the declaration.",
  });
}

const BOUNDARY_LABELS: Record<CombatProgressionBoundaryKind, string> = {
  declaration: "Declaration",
  phase1_initiative: "Phase 1 initiative",
  phase1_modifier_review: "Phase 1 modifier review",
  phase1_resolution: "Phase 1",
  phase2_initiative: "Phase 2 initiative",
  phase2_modifier_review: "Phase 2 modifier review",
  phase2_resolution: "Phase 2",
  round_boundary: "Round boundary",
  round_end: "Round end",
};

const ACTION_LABELS: Readonly<Record<string, string>> = {
  adjust_distance: "Adjust Distance",
  adjust_distance_attack: "Adjust Distance-Attack",
  attack: "Attack",
  combat_experience: "Combat Experience",
  declaration: "Declaration",
  distance: "Distance Control",
  double_attack: "Double Attack",
  effect_review: "Effect Review",
  feint: "Feint",
  feint_attack: "Feint-Attack",
  health_review: "Health Review",
  initiative: "Initiative",
  modifier_review: "Modifier Review",
  participant_review: "Participant Review",
  reactive_attack: "Reactive Attack",
  round_end: "Round End",
  single_attack: "Single Attack",
};

const TASK_ACTION_NAMES: Record<CombatProgressionTaskKind, string> = {
  adjust_distance_adjustment: "Adjust Distance",
  adjust_distance_attacker_roll: "Adjust Distance",
  adjust_distance_commit: "Adjust Distance",
  adjust_distance_defender_roll: "Adjust Distance",
  adjust_distance_response: "Adjust Distance",
  attack: "Attack",
  combat_experience: "Combat Experience",
  commit_initiative: "Initiative",
  critical: "Critical",
  damage_review: "Damage Review",
  distance_commit: "Distance Control",
  distance_roll: "Distance Control",
  double_attack_decision: "Double Attack",
  effect_review: "Effect Review",
  feint_attacker_roll: "Feint",
  feint_commit: "Feint",
  feint_defender_roll: "Feint",
  gm_advance_boundary: "GM Action",
  health_review: "Health Review",
  hit_location: "Hit Location",
  modifier_review: "Modifier Review",
  parry: "Parry",
  participant_review: "Participant Review",
  roll_initiative: "Initiative",
  round_end_prepare: "Round End",
  submit_declaration: "Declaration",
};

function taskList(
  progression: CombatProgressionPresentationProjection | undefined,
): CombatProgressionPresentationTask[] {
  if (progression?.taskVisibility !== "available") return [];
  return progression.processes.flatMap((process) =>
    process.stages.flatMap((stage) => stage.executionGroups.flatMap((group) => group.tasks)),
  );
}

function subject(
  identity: { label: string; participantId: string } | undefined,
  hiddenLabel: string,
): CombatPresentationSubject | undefined {
  return identity
    ? { hidden: false, id: identity.participantId, label: identity.label }
    : hiddenLabel
      ? { hidden: true, label: hiddenLabel }
      : undefined;
}

function taskInvolvesControlledParticipant(
  task: CombatProgressionPresentationTask,
  controlled: ReadonlySet<string>,
): boolean {
  return [
    task.owner?.kind === "combatant" ? task.owner.participantId : undefined,
    task.trackerFacet.owner?.participantId,
    task.presentationContext?.actor?.participantId,
    task.presentationContext?.responder?.participantId,
    task.presentationContext?.target?.participantId,
  ].some((participantId) => participantId !== undefined && controlled.has(participantId));
}

function viewerMayInvokeTask(
  task: CombatProgressionPresentationTask,
  viewer: CurrentActionViewerContext,
): boolean {
  if (viewer.kind === "gm") return task.actorAccess.gm;
  const controlled = viewer.controlledParticipantIds ?? new Set<string>();
  const participantOwnsTask =
    task.owner?.kind === "combatant" && controlled.has(task.owner.participantId);
  return (
    (task.actorAccess.combatant && participantOwnsTask) ||
    (Boolean(viewer.mayProxy) &&
      task.actorAccess.combatant &&
      task.actorAccess.gm &&
      participantOwnsTask)
  );
}

function selectTask(
  tasks: readonly CombatProgressionPresentationTask[],
  viewer: CurrentActionViewerContext,
): CombatProgressionPresentationTask | undefined {
  const progressionTasks = tasks.filter((task) => task.contributesToProgression);
  const controlled = viewer.controlledParticipantIds ?? new Set<string>();
  return (
    progressionTasks.find(
      (task) => task.state === "executable" && viewerMayInvokeTask(task, viewer),
    ) ??
    progressionTasks.find(
      (task) => viewer.kind === "player" && taskInvolvesControlledParticipant(task, controlled),
    ) ??
    progressionTasks.find((task) => task.state === "executable") ??
    progressionTasks[0]
  );
}

function phaseLabel(phase: CombatRoundPhase | undefined, boundary: CombatProgressionBoundaryKind) {
  return phase === "phase1"
    ? "Phase 1"
    : phase === "phase2"
      ? "Phase 2"
      : BOUNDARY_LABELS[boundary];
}

function actionName(task: CombatProgressionPresentationTask): string {
  const actionKind = task.presentationContext?.actionKind;
  return (actionKind && ACTION_LABELS[actionKind]) || TASK_ACTION_NAMES[task.kind];
}

function actorAndTarget(task: CombatProgressionPresentationTask): {
  actor?: CombatPresentationSubject;
  target?: CombatPresentationSubject;
} {
  const context = task.presentationContext;
  const hiddenOpponent = task.identity.opponentParticipantId ? "another combatant" : "";
  const owner = task.owner?.kind === "combatant" ? task.owner : undefined;
  if (context) {
    const actorHiddenLabel =
      !context.actor && (context.target || context.responder || task.opponent)
        ? "another combatant"
        : hiddenOpponent;
    const targetHiddenLabel =
      !context.target && context.actor ? "another combatant" : hiddenOpponent;
    return {
      actor: subject(context.actor, context.actor ? "" : actorHiddenLabel),
      target: subject(context.target, context.target ? "" : targetHiddenLabel),
    };
  }
  if (task.kind === "parry") {
    return {
      actor: subject(task.opponent, hiddenOpponent),
      target: subject(owner, "the defender"),
    };
  }
  return {
    actor: subject(owner ?? task.trackerFacet.owner, "a combatant"),
    target: subject(task.opponent, hiddenOpponent),
  };
}

function requiredActor(task: CombatProgressionPresentationTask): CombatPresentationSubject {
  const gmOnly = task.actorAccess.gm && !task.actorAccess.combatant;
  if (gmOnly) return { hidden: false, id: "gm", label: "GM" };
  const responder = task.presentationContext?.responder;
  const owner = task.owner?.kind === "combatant" ? task.owner : undefined;
  return subject(responder ?? owner ?? task.trackerFacet.owner, "another combatant")!;
}

function summaryFor(input: {
  action: string;
  actor?: CombatPresentationSubject;
  target?: CombatPresentationSubject;
  task: CombatProgressionPresentationTask;
}): string {
  const actor = input.actor?.label ?? "A combatant";
  const target = input.target?.label;
  const distance = input.task.presentationContext?.distance;
  switch (input.task.kind) {
    case "submit_declaration":
      return "Choose your action for this round.";
    case "adjust_distance_response":
    case "adjust_distance_adjustment":
    case "adjust_distance_attacker_roll":
    case "adjust_distance_defender_roll":
    case "adjust_distance_commit":
      if (distance?.current !== undefined && distance.requested !== undefined) {
        const direction =
          distance.requested < distance.current
            ? "move closer"
            : distance.requested > distance.current
              ? "move farther away"
              : "maintain the distance";
        return `${actor} is attempting to ${direction}.`;
      }
      return `${actor} is attempting to adjust the distance${target ? ` to ${target}` : ""}.`;
    case "attack":
      return `${actor} is attacking${target ? ` ${target}` : ""}.`;
    case "parry":
      return `${target ?? "The defender"} is defending against ${actor}'s attack.`;
    case "feint_attacker_roll":
    case "feint_defender_roll":
    case "feint_commit":
      return `${actor} is attempting to feint${target ? ` ${target}` : ""}.`;
    case "gm_advance_boundary":
      return boundaryCompleteSummary(input.task.transition?.currentBoundary ?? "declaration");
    case "commit_initiative":
      return "Initiative is complete.";
    case "roll_initiative":
      return `Initiative is open for ${actor}.`;
    case "modifier_review":
      return `${phaseLabel(
        input.task.identity.phase,
        input.task.trackerFacet.step === "M2" ? "phase2_modifier_review" : "phase1_modifier_review",
      )} modifiers are ready for review.`;
    case "health_review":
      return `${actor} needs a Health roll.`;
    case "combat_experience":
      return `${actor} needs a Combat Experience roll.`;
    case "distance_roll":
    case "distance_commit":
      return `${actor} is resolving distance control${target ? ` with ${target}` : ""}.`;
    case "double_attack_decision":
      return `${actor} has completed the first attack.`;
    case "round_end_prepare":
      return "The combat phases are complete.";
    case "effect_review":
      return `Review ${actor}'s active effects.`;
    case "participant_review":
      return `Review ${actor} for the end of the round.`;
    default:
      return target
        ? `${actor} is resolving ${input.action} against ${target}.`
        : `${actor} is resolving ${input.action}.`;
  }
}

function boundaryCompleteSummary(boundary: CombatProgressionBoundaryKind): string {
  switch (boundary) {
    case "declaration":
      return "Declarations are complete.";
    case "phase1_modifier_review":
      return "Phase 1 modifier review is complete.";
    case "phase1_initiative":
      return "Phase 1 initiative is complete.";
    case "phase1_resolution":
      return "Phase 1 is complete.";
    case "phase2_modifier_review":
      return "Phase 2 modifier review is complete.";
    case "phase2_initiative":
      return "Phase 2 initiative is complete.";
    case "phase2_resolution":
      return "Phase 2 is complete.";
    case "round_end":
    case "round_boundary":
      return "The round is complete.";
  }
}

function boundaryInstruction(target: CombatProgressionBoundaryKind | undefined): string {
  switch (target) {
    case "declaration":
      return "Open declarations.";
    case "phase1_modifier_review":
      return "Open Phase 1 modifier review.";
    case "phase1_initiative":
      return "Open Phase 1 initiative.";
    case "phase1_resolution":
      return "Open Phase 1 actions.";
    case "phase2_modifier_review":
      return "Open Phase 2 modifier review.";
    case "phase2_initiative":
      return "Open Phase 2 initiative.";
    case "phase2_resolution":
      return "Open Phase 2 actions.";
    case "round_end":
      return "Begin round end.";
    case "round_boundary":
      return "Start the next round.";
    default:
      return "Continue combat.";
  }
}

function boundaryButtonLabel(target: CombatProgressionBoundaryKind | undefined): string {
  switch (target) {
    case "phase1_modifier_review":
      return "Open Phase 1";
    case "phase2_modifier_review":
      return "Open Phase 2";
    case "round_boundary":
      return "Start next round";
    default:
      return boundaryInstruction(target).replace(/\.$/, "");
  }
}

function buttonLabel(task: CombatProgressionPresentationTask): string {
  switch (task.kind) {
    case "submit_declaration":
      return "Declare action";
    case "combat_experience":
      return task.expectedCommand === "set_combat_experience_difficulty"
        ? "Open Combat Experience"
        : "Roll Combat Experience";
    case "modifier_review":
      return "Complete modifier review";
    case "roll_initiative":
      return "Roll initiative";
    case "commit_initiative":
      return "Commit initiative";
    case "double_attack_decision":
      return "Choose Continue or Cancel";
    case "attack":
      return "Roll attack";
    case "parry":
      return "Roll parry";
    case "hit_location":
      return "Roll hit location";
    case "critical":
      return "Roll critical";
    case "damage_review":
      return "Commit damage";
    case "feint_attacker_roll":
      return "Roll Feint";
    case "feint_defender_roll":
      return "Roll Feint resistance";
    case "feint_commit":
      return "Commit Feint result";
    case "adjust_distance_response":
      return "Choose whether to oppose";
    case "adjust_distance_adjustment":
      return "Confirm Dodge adjustment";
    case "adjust_distance_attacker_roll":
      return "Roll Dodge";
    case "adjust_distance_defender_roll":
      return "Roll Dodge";
    case "adjust_distance_commit":
      return "Apply distance";
    case "distance_roll":
      return "Roll distance control";
    case "distance_commit":
      return "Apply distance control";
    case "health_review":
      return "Roll Health";
    case "effect_review":
      return "Complete effect review";
    case "participant_review":
      return "Complete participant review";
    case "round_end_prepare":
      return "Begin round end";
    case "gm_advance_boundary":
      return boundaryButtonLabel(task.transition?.targetBoundary);
  }
}

function requiredNowFor(
  task: CombatProgressionPresentationTask,
  status: CurrentActionPresentation["status"],
): string {
  if (status === "awaiting_gm") return "Waiting for GM.";
  if (status === "waiting") return "Waiting for another combatant.";
  switch (task.kind) {
    case "submit_declaration":
      return "Declare your action.";
    case "combat_experience":
      return task.expectedCommand === "set_combat_experience_difficulty"
        ? "Set the Combat Experience difficulty."
        : "Roll Combat Experience.";
    case "modifier_review":
      return "Complete modifier review.";
    case "roll_initiative":
      return "Roll initiative.";
    case "commit_initiative":
      return "Commit initiative.";
    case "double_attack_decision":
      return "Choose Continue or Cancel.";
    case "attack":
      return "Roll attack.";
    case "parry":
      return "Roll parry.";
    case "hit_location":
      return "Roll hit location.";
    case "critical":
      return "Roll critical.";
    case "damage_review":
      return "Commit damage.";
    case "feint_attacker_roll":
      return "Roll Feint.";
    case "feint_defender_roll":
      return "Roll Feint resistance.";
    case "feint_commit":
      return "Commit the Feint result.";
    case "adjust_distance_response":
      return "Choose whether to oppose.";
    case "adjust_distance_adjustment":
      return "Confirm the Dodge adjustment.";
    case "adjust_distance_attacker_roll":
    case "adjust_distance_defender_roll":
      return "Roll Dodge.";
    case "adjust_distance_commit":
      return "Apply the distance.";
    case "distance_roll":
      return "Roll distance control.";
    case "distance_commit":
      return "Apply the distance result.";
    case "health_review":
      return "Roll Health.";
    case "effect_review":
      return "Complete the effect review.";
    case "participant_review":
      return "Complete the participant review.";
    case "round_end_prepare":
      return "Begin round end.";
    case "gm_advance_boundary":
      return boundaryInstruction(task.transition?.targetBoundary);
  }
}

function waitingLabel(task: CombatProgressionPresentationTask, viewerMayInvoke: boolean): string {
  if (viewerMayInvoke && task.state === "executable") return buttonLabel(task);
  return task.actorAccess.gm && !task.actorAccess.combatant
    ? "Waiting for GM"
    : "Waiting for another combatant";
}

function specialPresentation(
  input: BuildCurrentActionPresentationInput,
): CurrentActionPresentation {
  const boundary = input.progression?.boundary.kind ?? "declaration";
  const conflicted = input.progression?.taskVisibility === "conflicted";
  const awaitingGm = !conflicted && Boolean(input.progression?.awaitingGmTransition);
  const actionName = "GM Action";
  const status = conflicted ? "conflicted" : "awaiting_gm";
  const summary = conflicted
    ? "Combat information is temporarily unavailable."
    : boundaryCompleteSummary(boundary);
  return Object.freeze({
    actionName,
    boundary,
    encounterId: input.encounterId,
    encounterRevision: input.encounterRevision ?? "",
    heading: BOUNDARY_LABELS[boundary],
    primaryAction: {
      enabled: false,
      gmProxyAvailable: false,
      label: awaitingGm ? "Waiting for GM" : "Action unavailable",
      viewerMayInvoke: false,
    },
    reason: "",
    requiredActor: { hidden: false, id: "gm", label: "GM" },
    requiredNow: "Waiting for GM.",
    status,
    summary,
    taskHeading: awaitingGm ? "Waiting for GM" : "Action unavailable",
  });
}

/** Builds one display-ready Current Action from the accepted progression revision only. */
export function buildCurrentActionPresentation(
  input: BuildCurrentActionPresentationInput,
): CurrentActionPresentation | null {
  if (!input.progression || !input.encounterRevision) return null;
  if (
    input.progression.taskVisibility === "conflicted" ||
    (input.progression.awaitingGmTransition && input.viewer.kind === "player")
  ) {
    return specialPresentation(input);
  }
  const task = selectTask(taskList(input.progression), input.viewer);
  if (!task) return null;

  const action = actionName(task);
  const { actor, target } = actorAndTarget(task);
  const required = requiredActor(task);
  const viewerMayInvoke = viewerMayInvokeTask(task, input.viewer);
  const gmProxyAvailable =
    task.actorAccess.gm && task.owner?.kind === "combatant" && task.actorAccess.combatant;
  const status =
    task.actorAccess.gm && !task.actorAccess.combatant && !viewerMayInvoke
      ? "awaiting_gm"
      : task.state === "executable" && viewerMayInvoke
        ? "executable"
        : "waiting";
  const phase = task.identity.phase;
  const actionPhaseLabel =
    task.kind === "gm_advance_boundary"
      ? BOUNDARY_LABELS[task.transition?.currentBoundary ?? input.progression.boundary.kind]
      : phaseLabel(phase, input.progression.boundary.kind);
  const descriptor = Object.freeze({
    attackResultId: task.identity.attackResultId,
    commandType: task.expectedCommand,
    encounterId: input.encounterId,
    expectedBoundary: input.progression.boundary.kind,
    expectedRevision: input.encounterRevision,
    healthRollId: task.identity.healthRollId,
    opponentParticipantId: task.identity.opponentParticipantId,
    opportunityId: task.identity.opportunityId,
    pairId: task.identity.pairId,
    participantId:
      task.owner?.kind === "combatant" ? task.owner.participantId : task.identity.participantId,
    phase,
    proposalId: task.identity.proposalId,
    targetBoundary: task.transition?.targetBoundary,
    taskId: task.id,
  } satisfies CurrentActionCommandDescriptor);
  const summary = summaryFor({ action, actor, target, task });
  const requiredNow = requiredNowFor(task, status);

  return Object.freeze({
    actionKind: task.presentationContext?.actionKind,
    actionName: action,
    actor,
    boundary: input.progression.boundary.kind,
    distance: task.presentationContext?.distance,
    difficulty: task.presentationContext?.difficulty,
    encounterId: input.encounterId,
    encounterRevision: input.encounterRevision,
    executionGroupId: task.executionGroupId,
    heading: actionPhaseLabel,
    phase,
    primaryAction: {
      descriptor: viewerMayInvoke ? descriptor : undefined,
      enabled: status === "executable",
      gmProxyAvailable,
      label: waitingLabel(task, viewerMayInvoke),
      viewerMayInvoke,
    },
    processId: task.processId,
    reason: "",
    requiredActor: required,
    requiredNow,
    skill: task.presentationContext?.skill?.label
      ? {
          id: task.presentationContext.skill.id,
          label: task.presentationContext.skill.label,
        }
      : undefined,
    stageId: task.stageId,
    status,
    summary,
    target,
    taskHeading: requiredNow.replace(/\.$/, ""),
    taskId: task.id,
    taskKind: task.kind,
    trackerFacet: task.trackerFacet.step,
    weapon: task.presentationContext?.weapon?.label
      ? {
          id: task.presentationContext.weapon.id,
          label: task.presentationContext.weapon.label,
        }
      : undefined,
  });
}

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
  gm_advance_boundary: "Combat Progression",
  health_review: "Health Review",
  hit_location: "Hit Location",
  modifier_review: "Modifier Review",
  parry: "Parry",
  participant_review: "Participant Review",
  roll_initiative: "Initiative",
  round_end_prepare: "Round End",
  submit_declaration: "Declaration",
};

const INPUT_LABELS: Record<CombatProgressionTaskKind, string> = {
  adjust_distance_adjustment: "GM adjustment",
  adjust_distance_attacker_roll: "attacker Dodge roll",
  adjust_distance_commit: "GM proposal commit",
  adjust_distance_defender_roll: "defender Dodge roll",
  adjust_distance_response: "defender response",
  attack: "attack roll",
  combat_experience: "Combat Experience input",
  commit_initiative: "GM initiative commit",
  critical: "critical roll",
  damage_review: "GM damage review",
  distance_commit: "GM distance commit",
  distance_roll: "Dodge roll",
  double_attack_decision: "Continue or Cancel decision",
  effect_review: "GM effect review",
  feint_attacker_roll: "attacker roll",
  feint_commit: "GM proposal commit",
  feint_defender_roll: "defender roll",
  gm_advance_boundary: "GM boundary transition",
  health_review: "Health check",
  hit_location: "hit-location roll",
  modifier_review: "GM modifier review",
  parry: "defender response",
  participant_review: "participant review",
  roll_initiative: "initiative roll",
  round_end_prepare: "GM round-end preparation",
  submit_declaration: "declaration",
};

function taskList(
  progression: CombatProgressionPresentationProjection | undefined,
): CombatProgressionPresentationTask[] {
  if (progression?.taskVisibility !== "available") return [];
  return progression.processes.flatMap((process) =>
    process.stages.flatMap((stage) =>
      stage.executionGroups.flatMap((group) => group.tasks),
    ),
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
      (task) =>
        viewer.kind === "player" && taskInvolvesControlledParticipant(task, controlled),
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
    case "adjust_distance_response":
    case "adjust_distance_adjustment":
    case "adjust_distance_attacker_roll":
    case "adjust_distance_defender_roll":
    case "adjust_distance_commit":
      return distance?.current !== undefined && distance.requested !== undefined
        ? `${actor} is attempting to move from distance ${distance.current} to distance ${distance.requested}${target ? ` against ${target}` : ""}.`
        : `${actor} is attempting to adjust distance${target ? ` against ${target}` : ""}.`;
    case "attack":
      return `${actor} is attacking${target ? ` ${target}` : ""}${input.task.presentationContext?.weapon?.label ? ` with ${input.task.presentationContext.weapon.label}` : ""}.`;
    case "parry":
      return `${target ?? "The defender"} is responding to ${actor}'s attack.`;
    case "feint_attacker_roll":
    case "feint_defender_roll":
    case "feint_commit":
      return `${actor} is attempting a ${input.task.presentationContext?.actionKind === "feint_attack" ? "Feint" : input.action}${target ? ` against ${target}` : ""}.`;
    case "gm_advance_boundary":
      return `All required work in ${BOUNDARY_LABELS[input.task.transition?.currentBoundary ?? "declaration"]} is complete.`;
    case "commit_initiative":
      return "All required initiative rolls and choices are complete.";
    case "health_review":
      return `${actor} requires a round-end Health check.`;
    case "combat_experience":
      return input.task.presentationContext?.difficulty !== undefined
        ? `${actor} must resolve Combat Experience at difficulty ${input.task.presentationContext.difficulty}.`
        : `${actor} must resolve Combat Experience.`;
    case "distance_roll":
    case "distance_commit":
      return `${actor} is resolving round-end distance control${target ? ` with ${target}` : ""}.`;
    default:
      return target
        ? `${input.action} is in progress for ${actor} against ${target}.`
        : `${input.action} is in progress for ${actor}.`;
  }
}

function reasonFor(task: CombatProgressionPresentationTask, action: string): string {
  if (task.presentationContext?.reason) return task.presentationContext.reason;
  switch (task.kind) {
    case "attack":
      return `This attack follows the declared ${action}.`;
    case "parry":
      return "The attack hit or threatened the defender and permits a defensive response.";
    case "adjust_distance_response":
      return "The defender must choose whether to allow or oppose the requested movement.";
    case "adjust_distance_adjustment":
      return "The movement is opposed, so the GM must confirm the roll adjustment.";
    case "adjust_distance_attacker_roll":
    case "adjust_distance_defender_roll":
      return "The movement is opposed and requires both Dodge results.";
    case "adjust_distance_commit":
      return "The distance proposal is ready for GM review and commit.";
    case "feint_attacker_roll":
    case "feint_defender_roll":
      return "The Feint contest requires both participants' relevant skill results.";
    case "feint_commit":
      return "Both Feint inputs are complete and the proposal is ready for GM commit.";
    case "double_attack_decision":
      return "The first attack is complete and the second attack requires an explicit decision.";
    case "combat_experience":
      return "Combat Experience must be resolved before the blocked combat work can continue.";
    case "health_review":
      return "A round-end condition requires a Health check before review can continue.";
    case "gm_advance_boundary":
      return "Completing child work does not open the next combat boundary automatically.";
    case "commit_initiative":
      return "The GM must commit initiative before phase execution order opens.";
    case "submit_declaration":
      return "A declaration is required before combat can progress to modifier review.";
    default:
      return `This input is required to complete the current ${action} stage.`;
  }
}

function nextFor(task: CombatProgressionPresentationTask): { label: string; processId?: string } {
  switch (task.kind) {
    case "attack":
      return { label: "If the attack succeeds, the defender may parry." };
    case "parry":
      return { label: "The attack either completes or proceeds to post-hit work." };
    case "hit_location":
      return { label: "Critical or damage review follows as required." };
    case "critical":
      return { label: "Damage and effects review follows." };
    case "damage_review":
      return { label: "The attack process completes after accepted damage and effects." };
    case "adjust_distance_response":
      return { label: "Allow resolves the movement; oppose proceeds to adjustment and Dodge." };
    case "adjust_distance_adjustment":
      return { label: "The participants roll Dodge after the adjustment is confirmed." };
    case "adjust_distance_attacker_roll":
    case "adjust_distance_defender_roll":
      return { label: "The higher Dodge result determines whether the distance changes." };
    case "adjust_distance_commit":
      return { label: "The maneuver completes; its later attack remains boundary-controlled." };
    case "feint_attacker_roll":
      return { label: "The defender's Feint resistance roll follows." };
    case "feint_defender_roll":
      return { label: "The GM reviews and commits the Feint proposal." };
    case "feint_commit":
      return { label: "The maneuver completes; its later attack remains boundary-controlled." };
    case "double_attack_decision":
      return { label: "Continue opens Attack 2 later; Cancel completes Double Attack." };
    case "roll_initiative":
      return { label: "After all rolls and choices, the GM commits initiative." };
    case "commit_initiative":
      return { label: "The committed phase execution order becomes active." };
    case "submit_declaration":
      return { label: "Remaining declarations continue, then the GM opens modifier review." };
    case "combat_experience":
      return { label: "The blocked declaration, initiative choice, or review resumes." };
    case "health_review":
      return { label: "Round-end participant and effect review continues." };
    case "distance_roll":
      return { label: "The remaining roll or GM distance commit follows." };
    case "distance_commit":
      return { label: "Round-end participant review continues." };
    case "effect_review":
    case "participant_review":
      return { label: "The next ordered round-end participant or effect is reviewed." };
    case "round_end_prepare":
      return { label: "Distance and participant round-end processes become available." };
    case "gm_advance_boundary":
      return {
        label: task.transition
          ? `${BOUNDARY_LABELS[task.transition.targetBoundary]} becomes active.`
          : "The next combat boundary becomes active.",
      };
    case "modifier_review":
      return { label: "The next participant review or initiative boundary follows." };
  }
}

function buttonLabel(task: CombatProgressionPresentationTask): string {
  switch (task.kind) {
    case "submit_declaration":
      return "Submit declaration";
    case "combat_experience":
      return task.expectedCommand === "set_combat_experience_difficulty"
        ? "Open Combat Experience"
        : "Roll Combat Experience";
    case "modifier_review":
      return "Commit modifier review";
    case "roll_initiative":
      return `Roll ${task.identity.phase === "phase2" ? "Phase 2" : "Phase 1"} initiative`;
    case "commit_initiative":
      return `Commit ${task.identity.phase === "phase2" ? "Phase 2" : "Phase 1"} initiative`;
    case "double_attack_decision":
      return "Confirm Attack 2 decision";
    case "attack":
      return `Roll ${task.identity.phase === "phase2" ? "Phase 2" : "Phase 1"} attack`;
    case "parry":
      return "Roll parry";
    case "hit_location":
      return "Roll hit location";
    case "critical":
      return "Roll critical";
    case "damage_review":
      return "Commit damage review";
    case "feint_attacker_roll":
      return "Roll Feint";
    case "feint_defender_roll":
      return "Roll Feint resistance";
    case "feint_commit":
      return "Commit Feint result";
    case "adjust_distance_response":
      return "Confirm defender response";
    case "adjust_distance_adjustment":
      return "Confirm maneuver adjustment";
    case "adjust_distance_attacker_roll":
      return "Roll attacker Dodge";
    case "adjust_distance_defender_roll":
      return "Roll defender Dodge";
    case "adjust_distance_commit":
      return "Commit distance adjustment";
    case "distance_roll":
      return "Roll distance control";
    case "distance_commit":
      return "Apply distance control";
    case "health_review":
      return "Roll Health check";
    case "effect_review":
      return "Commit participant SU review";
    case "participant_review":
      return "Complete participant review";
    case "round_end_prepare":
      return "Prepare round-end review";
    case "gm_advance_boundary":
      return task.transition?.targetBoundary === "round_boundary"
        ? "Start next round"
        : `Open ${BOUNDARY_LABELS[task.transition?.targetBoundary ?? "declaration"]}`;
  }
}

function waitingLabel(
  task: CombatProgressionPresentationTask,
  viewerMayInvoke: boolean,
): string {
  if (viewerMayInvoke && task.state === "executable") return buttonLabel(task);
  return task.actorAccess.gm && !task.actorAccess.combatant
    ? "Waiting for GM"
    : "Waiting for another combatant";
}

function specialPresentation(input: BuildCurrentActionPresentationInput): CurrentActionPresentation {
  const boundary = input.progression?.boundary.kind ?? "declaration";
  const conflicted = input.progression?.taskVisibility === "conflicted";
  const awaitingGm = !conflicted && Boolean(input.progression?.awaitingGmTransition);
  const actionName = conflicted ? "Combat progression" : "Combat progression";
  const status = conflicted ? "conflicted" : "awaiting_gm";
  const summary = conflicted
    ? "The current combat task cannot be presented safely because progression facts conflict."
    : `Required work in ${BOUNDARY_LABELS[boundary]} is complete.`;
  return Object.freeze({
    actionName,
    boundary,
    encounterId: input.encounterId,
    encounterRevision: input.encounterRevision ?? "",
    heading: `${actionName} · ${BOUNDARY_LABELS[boundary]}`,
    primaryAction: {
      enabled: false,
      gmProxyAvailable: false,
      label: awaitingGm ? "Waiting for GM" : "Action unavailable",
      viewerMayInvoke: false,
    },
    reason: conflicted
      ? "Ambiguous progression must be repaired before an action is offered."
      : "The GM explicitly opens each top-level combat boundary.",
    requiredActor: { hidden: false, id: "gm", label: "GM" },
    requiredNow: conflicted
      ? "The GM must refresh or repair combat progression."
      : "The GM must advance combat when ready.",
    status,
    summary,
    taskHeading: conflicted
      ? "Combat progression — review required"
      : "Combat progression — GM advancement",
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
  const actionPhaseLabel = phaseLabel(phase, input.progression.boundary.kind);
  const headingSubjects = actor
    ? ` · ${actor.label}${target ? ` → ${target.label}` : ""}`
    : "";
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
  const reason = reasonFor(task, action);
  const requiredNow =
    status === "awaiting_gm"
      ? `The GM must ${INPUT_LABELS[task.kind].toLowerCase()}.`
      : status === "waiting"
        ? `${required.label} must provide the ${INPUT_LABELS[task.kind]}.`
        : `${required.label} must provide the ${INPUT_LABELS[task.kind]}.`;

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
    expectedNextProcess: nextFor(task),
    heading: `${action}${headingSubjects} · ${actionPhaseLabel}`,
    phase,
    primaryAction: {
      descriptor,
      enabled: status === "executable",
      gmProxyAvailable,
      label: waitingLabel(task, viewerMayInvoke),
      viewerMayInvoke,
    },
    processId: task.processId,
    reason,
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
    taskHeading: `${action} — ${INPUT_LABELS[task.kind]}`,
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

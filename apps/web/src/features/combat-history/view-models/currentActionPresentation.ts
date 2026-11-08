import { combatContextHasSupersededGmFigure } from "@glantri/domain";
import type {
  CombatProgressionBoundaryKind,
  CombatProgressionExpectedCommand,
  CombatProgressionPresentationProjection,
  CombatProgressionPresentationTask,
  CombatProgressionTaskKind,
  CombatRoundPhase,
  CombatRoundState,
  OffensiveParryRollPurpose,
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
  readonly actionId?: string;
  readonly attackIndex?: number;
  readonly attackModeId?: string;
  readonly attackResultId?: string;
  readonly attackerParticipantId?: string;
  readonly commandType: CombatProgressionExpectedCommand;
  readonly criticalResultId?: string;
  readonly contestId?: string;
  readonly continuedContactId?: string;
  readonly damageRollExpression?: string;
  readonly damageReviewId?: string;
  readonly declarationId?: string;
  readonly declaredOpponentParticipantId?: string;
  readonly defenderParticipantId?: string;
  readonly disarmAttemptId?: string;
  readonly encounterId: string;
  readonly executionGroupId?: string;
  readonly expectedBoundary: CombatProgressionBoundaryKind;
  readonly expectedRevision: string;
  readonly healthRollId?: string;
  readonly hitLocationResultId?: string;
  readonly initiativeGroupId?: string;
  readonly initiativeValue?: number;
  readonly opponentParticipantId?: string;
  readonly opportunityId?: string;
  readonly offensiveParryAttemptId?: string;
  readonly observationAttemptId?: string;
  readonly parryPurpose?: "ordinary_defense" | "offensive_parry" | "parry_disarm";
  readonly parryResultId?: string;
  readonly parrySourceId?: string;
  readonly pairId?: string;
  readonly participantId?: string;
  readonly phase?: CombatRoundPhase;
  readonly processId?: string;
  readonly proposalId?: string;
  readonly relationshipId?: string;
  readonly rollPurpose?: OffensiveParryRollPurpose;
  readonly stageId?: string;
  readonly targetBoundary?: CombatProgressionBoundaryKind;
  readonly taskId: string;
  readonly weaponInstanceId?: string;
  readonly weaponSourceId?: string;
  readonly weaponSourceSlot?: string;
  readonly weaponTemplateId?: string;
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
  readonly damageRollExpression?: string;
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
  /**
   * The `participantId:phase` keys whose attack-phase modifier rows carry a figure a rule event
   * superseded (#931). Every caller derives it from its own round state with
   * `getSupersededModifierReviewKeys`; nothing here keys on the viewer.
   *
   * That is what keeps the signal off the player side. The round state this page is served comes
   * through `playerFacingCombatContextSchema`, an allowlist that does not carry
   * `supersededGmFigure`, so a player's round state holds no such row, the set is empty and the
   * wording cannot be composed — the projection enforces it, not a flag this view-model could get
   * wrong (Product Owner ruling, #931 comment 21255). Measured on a real player read.
   *
   * The claim is about *this* round state. Two other player reads do not go through that allowlist
   * and are sanitised explicitly instead; see `supersededGmFigureAudience.ts`. Do not generalise
   * the allowlist's protection to a read nobody has measured.
   */
  readonly supersededModifierReviewKeys?: ReadonlySet<string>;
  readonly viewer: CurrentActionViewerContext;
}

/** The key a superseded attack-phase review is held under: one participant, one phase. */
export function supersededModifierReviewKey(
  participantId: string,
  phase: "phase1" | "phase2",
): string {
  return `${participantId}:${phase}`;
}

/**
 * Collects the superseded-review keys from a round state. Run it on the state the surface already
 * holds: the GM panel's stored round state carries `supersededGmFigure`, the player page's
 * player-facing round state cannot, so the same code yields an empty set there.
 */
export function getSupersededModifierReviewKeys(
  state?: Pick<CombatRoundState, "participants"> | null,
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const participant of state?.participants ?? []) {
    const declaration = participant.declaration;
    if (!declaration) continue;
    for (const phase of ["phase1", "phase2"] as const) {
      const superseded = [declaration.combatContext, declaration.phaseContexts?.[phase]].some(
        (context) => context !== undefined && combatContextHasSupersededGmFigure(context, phase),
      );
      if (superseded) keys.add(supersededModifierReviewKey(participant.participantId, phase));
    }
  }
  return keys;
}

/**
 * Resolves an immutable task command without consulting inspector, result, or component state.
 * Task-specific handlers still declare their exact required identity fields at the call site.
 */
export function resolveCombatTaskCommandContext(input: {
  readonly descriptor?: CurrentActionCommandDescriptor;
  readonly expectedCommandTypes: readonly CombatProgressionExpectedCommand[];
  readonly presentation?: CurrentActionPresentation | null;
  readonly requiredFields: readonly (keyof CurrentActionCommandDescriptor)[];
}): CurrentActionCommandDescriptor | undefined {
  const descriptor = input.descriptor;
  const presentation = input.presentation;
  if (
    !descriptor ||
    !presentation ||
    descriptor.taskId !== presentation.taskId ||
    descriptor.expectedRevision !== presentation.encounterRevision ||
    !input.expectedCommandTypes.includes(descriptor.commandType) ||
    input.requiredFields.some((field) => {
      const value = descriptor[field];
      return value === undefined || value === "";
    })
  ) {
    return undefined;
  }
  return descriptor;
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
  missile_readiness: "Missile Preparation",
  break_off_engagement: "Break Off",
  combat_experience: "Combat Experience",
  continued_contact_distance_control: "Continued Contact",
  continued_contact_maintenance_controller: "Continued Contact",
  continued_contact_maintenance_escape: "Continued Contact",
  declaration: "Declaration",
  distance: "Distance Control",
  double_attack: "Double Attack",
  effect_review: "Effect Review",
  feint: "Feint",
  feint_attack: "Feint-Attack",
  health_review: "Health Review",
  initiative: "Initiative",
  modifier_review: "Modifier Review",
  observe_opponent_contest: "Observe Opponent",
  offensive_parry: "Offensive Parry",
  offensive_parry_brawling_roll: "Offensive Parry",
  observation_roll: "Observe Opponent",
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
  missile_readiness: "Missile Preparation",
  break_off_attacker_roll: "Break Off",
  break_off_commit: "Break Off",
  break_off_escapee_roll: "Break Off",
  break_off_review: "Break Off",
  disarm_actor_roll: "Disarm",
  disarm_holder_roll: "Disarm",
  disarm_commit: "Disarm",
  combat_experience: "Combat Experience",
  combat_task_advance: "Perform Task",
  combat_task_resolve: "Perform Task",
  combat_task_review: "Perform Task",
  combat_task_roll: "Perform Task",
  continued_contact_maintenance_roll: "Continued Contact",
  commit_initiative: "Initiative",
  critical: "Critical",
  damage_roll: "Graze Damage",
  damage_review: "Damage Review",
  defense_review: "Defense Review",
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
  observation_roll: "Observe Opponent",
  offensive_parry_brawling_roll: "Offensive Parry",
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
  progression: CombatProgressionPresentationProjection,
  viewer: CurrentActionViewerContext,
): CombatProgressionPresentationTask | undefined {
  const progressionTasks = tasks.filter((task) => task.contributesToProgression);
  const position = progression.canonicalOperationalPosition;
  const canonicalTask = position?.task;
  const controlled = viewer.controlledParticipantIds ?? new Set<string>();
  const viewerTaskInCanonicalStage = position?.stageId
    ? progressionTasks.find(
        (task) =>
          task.stageId === position.stageId &&
          task.state === "executable" &&
          viewerMayInvokeTask(task, viewer),
      )
    : undefined;
  if (canonicalTask) {
    if (viewerMayInvokeTask(canonicalTask, viewer)) return canonicalTask;
    if (viewerTaskInCanonicalStage) return viewerTaskInCanonicalStage;
    return canonicalTask;
  }
  if (position) return viewerTaskInCanonicalStage;
  return (
    progressionTasks.find(
      (task) => task.state === "executable" && viewerMayInvokeTask(task, viewer),
    ) ??
    progressionTasks.find((task) => task.state === "executable") ??
    progressionTasks.find(
      (task) => viewer.kind === "player" && taskInvolvesControlledParticipant(task, controlled),
    ) ??
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

/**
 * Forgejo #874 finding 4. A defense review is framed around the defender, but the weapon its task
 * carries is the attacking opportunity's weapon (`buildAdapterAttackProcess` copies
 * `plan.opportunity`'s weapon into the task's `presentationContext.weapon`). The bare label was read
 * as the defender's, so on a defense review it names whose weapon it is.
 */
function weaponLabelFor(
  task: CombatProgressionPresentationTask,
  actor: CombatPresentationSubject | undefined,
  label: string,
): string {
  if (task.kind !== "defense_review") return label;
  return actor && !actor.hidden ? `${actor.label}'s ${label}` : `${label} (attacking weapon)`;
}

function requiredActor(task: CombatProgressionPresentationTask): CombatPresentationSubject {
  const gmOnly = task.actorAccess.gm && !task.actorAccess.combatant;
  if (gmOnly) return { hidden: false, id: "gm", label: "GM" };
  const responder = task.presentationContext?.responder;
  const owner = task.owner?.kind === "combatant" ? task.owner : undefined;
  return subject(responder ?? owner ?? task.trackerFacet.owner, "another combatant")!;
}

/**
 * The Product Owner's wording for a review re-offered because a rule event replaced the GM's
 * committed figure (#931 comment 21255, recorded verbatim there). It leads the summary rather than
 * trailing it: a rendered reading at 768, 1024 and 1440 CSS px measured the previous suffix-shaped
 * signal clipped before a GM could read it, and a suffix is the shape that failed.
 */
const SUPERSEDED_MODIFIER_REVIEW_SUMMARY =
  "Rule changed the committed DB/Parry value — review again.";

function summaryFor(input: {
  action: string;
  actor?: CombatPresentationSubject;
  supersededModifierReviewKeys?: ReadonlySet<string>;
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
    case "break_off_review":
    case "break_off_escapee_roll":
    case "break_off_attacker_roll":
    case "break_off_commit":
      return `${actor} is attempting to break off${target ? ` from ${target}` : ""}.`;
    case "parry":
      if (input.task.identity.parryPurpose === "offensive_parry") {
        const attackOutcome = input.task.presentationContext?.attackOutcome;
        return `${actor} committed to an attack.${attackOutcome ? ` The attack ${attackOutcome === "hit" ? "hit" : "missed"}.` : ""} ${target ?? "The defender"} prepared an Offensive Parry.`;
      }
      return `${actor} hit ${target ?? "the defender"}.`;
    case "defense_review":
      return `Review ${target ?? "the defender"}'s defense sources for this attack.`;
    case "offensive_parry_brawling_roll":
      return input.task.presentationContext?.responder?.participantId ===
        input.task.presentationContext?.actor?.participantId
        ? `Your Offensive Parry succeeded. Contest ${target ?? "the attacker"}'s balance.`
        : `${actor} maintained contact after the parry.`;
    case "continued_contact_maintenance_roll":
      return input.task.presentationContext?.actionKind ===
        "continued_contact_maintenance_controller"
        ? `Maintain Continued Contact with ${target ?? "the opponent"}.`
        : `Attempt to escape ${actor}'s Continued Contact.`;
    case "observation_roll":
      return `You have completed an observation interval against ${target ?? "the opponent"}.`;
    case "hit_location":
    case "critical":
    case "damage_roll":
    case "damage_review":
      return `${actor} hit ${target ?? "the defender"}.`;
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
    case "modifier_review": {
      const phase = input.task.trackerFacet.step === "M2" ? "phase2" : "phase1";
      const ready = `${phaseLabel(
        input.task.identity.phase,
        phase === "phase2" ? "phase2_modifier_review" : "phase1_modifier_review",
      )} modifiers are ready for review.`;
      const owner =
        input.task.owner?.kind === "combatant" ? input.task.owner.participantId : undefined;
      const superseded =
        owner !== undefined &&
        input.supersededModifierReviewKeys?.has(supersededModifierReviewKey(owner, phase)) === true;
      return superseded ? `${SUPERSEDED_MODIFIER_REVIEW_SUMMARY} ${ready}` : ready;
    }
    case "health_review":
      return `${actor} needs a Health roll.`;
    case "combat_experience":
      return `${actor} needs a Combat Experience roll.`;
    case "distance_roll":
    case "distance_commit":
      if (input.task.presentationContext?.actionKind === "continued_contact_distance_control") {
        return `${actor} is choosing engagement distance${target ? ` with ${target}` : ""} because Continued Contact is active.`;
      }
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
    case "missile_readiness":
      return "Prepare missile weapon";
    case "break_off_review":
      return "Review Break Off";
    case "break_off_escapee_roll":
    case "break_off_attacker_roll":
      return "Roll Dodge";
    case "break_off_commit":
      return "Commit Break Off";
    case "disarm_actor_roll":
    case "disarm_holder_roll":
      return "Roll Disarm";
    case "disarm_commit":
      return "Commit Disarm";
    case "parry":
      return task.identity.parryPurpose === "offensive_parry"
        ? "Roll Offensive Parry"
        : "Roll parry";
    case "defense_review":
      return "Commit defense review";
    case "offensive_parry_brawling_roll":
      return "Roll Brawling";
    case "continued_contact_maintenance_roll":
      return "Roll Brawling";
    case "observation_roll":
      return "Roll observation";
    case "hit_location":
      return "Roll hit location";
    case "critical":
      return "Roll critical";
    case "damage_roll":
      return "Roll damage";
    case "damage_review":
      return task.expectedCommand === "resolve_damage" ? "Resolve damage" : "Commit damage";
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
      return task.presentationContext?.actionKind === "continued_contact_distance_control"
        ? "Choose engagement distance"
        : "Apply distance control";
    case "health_review":
      return "Roll Health";
    case "effect_review":
      return "Complete effect review";
    case "participant_review":
      return "Complete participant review";
    case "round_end_prepare":
      return "Begin round end";
    case "gm_advance_boundary":
      return task.expectedCommand === "complete_round"
        ? "Open next round"
        : boundaryButtonLabel(task.transition?.targetBoundary);
    case "combat_task_review":
      return "Review task";
    case "combat_task_roll":
      return "Roll for task";
    case "combat_task_advance":
      return "Continue task";
    case "combat_task_resolve":
      return "Resolve task";
  }
}

function requiredNowFor(
  task: CombatProgressionPresentationTask,
  status: CurrentActionPresentation["status"],
  requiredActorLabel: string,
): string {
  if (status === "awaiting_gm") return "Waiting for GM.";
  if (status === "waiting") return `Waiting for ${requiredActorLabel}.`;
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
    case "missile_readiness":
      return "Prepare the missile weapon or choose Rapid shot.";
    case "break_off_review":
      return "Review the Break Off modifiers.";
    case "break_off_escapee_roll":
    case "break_off_attacker_roll":
      return "Roll Dodge.";
    case "break_off_commit":
      return "Commit the Break Off result.";
    case "disarm_actor_roll":
    case "disarm_holder_roll":
      return "Roll weapon control for Disarm.";
    case "disarm_commit":
      return "Commit the Disarm result.";
    case "parry":
      return task.identity.parryPurpose === "offensive_parry"
        ? "Attempt the parry."
        : "Defend against the attack.";
    case "defense_review":
      return "Confirm applicable defense sources.";
    case "offensive_parry_brawling_roll":
      return "Roll Brawling.";
    case "continued_contact_maintenance_roll":
      return task.presentationContext?.actionKind === "continued_contact_maintenance_controller"
        ? "Maintain Continued Contact. Roll Brawling."
        : "Attempt to escape Continued Contact. Roll Brawling.";
    case "observation_roll":
      return "Roll your observation contest.";
    case "hit_location":
      return "Roll hit location.";
    case "critical":
      return "Roll critical.";
    case "damage_roll":
      return "Roll damage.";
    case "damage_review":
      return task.expectedCommand === "resolve_damage" ? "Resolve damage." : "Commit damage.";
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
      return task.presentationContext?.actionKind === "continued_contact_distance_control"
        ? "Choose engagement distance."
        : "Apply the distance result.";
    case "health_review":
      return "Roll Health.";
    case "effect_review":
      return "Complete the effect review.";
    case "participant_review":
      return "Complete the participant review.";
    case "round_end_prepare":
      return "Begin round end.";
    case "gm_advance_boundary":
      return task.expectedCommand === "complete_round"
        ? "Open next round."
        : boundaryInstruction(task.transition?.targetBoundary);
    case "combat_task_review":
      return "Review the declared task and set its rule inputs.";
    case "combat_task_roll":
      return "Roll for the declared task.";
    case "combat_task_advance":
      return "Continue the declared task this round.";
    case "combat_task_resolve":
      return "Resolve the task with its result and audience.";
  }
}

function waitingLabel(
  task: CombatProgressionPresentationTask,
  viewerMayInvoke: boolean,
  requiredActorLabel: string,
): string {
  if (viewerMayInvoke && task.state === "executable") return buttonLabel(task);
  return task.actorAccess.gm && !task.actorAccess.combatant
    ? "Waiting for GM"
    : `Waiting for ${requiredActorLabel}`;
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

function canonicalWaitingPresentation(
  input: BuildCurrentActionPresentationInput,
): CurrentActionPresentation {
  const progression = input.progression!;
  const position = progression.canonicalOperationalPosition!;
  const boundary = progression.boundary.kind;
  const waitingForGm = position.waitingFor === "gm";
  const modifierReview =
    boundary === "phase1_modifier_review" || boundary === "phase2_modifier_review";
  const roundEndCheckpoint = boundary === "round_boundary";
  const incomplete = position.taskVisibility === "unavailable";
  const requiredActor: CombatPresentationSubject = waitingForGm
    ? { hidden: false, id: "gm", label: "GM" }
    : { hidden: true, label: "another participant" };
  const requiredNow = incomplete
    ? "Waiting for the GM to repair the active combat state."
    : modifierReview && waitingForGm
      ? "Waiting for GM modifier review."
      : roundEndCheckpoint && waitingForGm
        ? "Waiting for GM to complete round-end review."
        : waitingForGm
          ? "Waiting for GM."
          : "Waiting for another participant.";
  return Object.freeze({
    actionName: incomplete ? "Combat state" : "Current combat task",
    boundary,
    encounterId: input.encounterId,
    encounterRevision: input.encounterRevision ?? "",
    heading: BOUNDARY_LABELS[boundary],
    primaryAction: {
      enabled: false,
      gmProxyAvailable: false,
      label: incomplete ? "Action unavailable" : waitingForGm ? "Waiting for GM" : "Waiting",
      viewerMayInvoke: false,
    },
    reason: "",
    requiredActor,
    requiredNow,
    status: waitingForGm || incomplete ? "awaiting_gm" : "waiting",
    summary: incomplete
      ? "The active encounter has incomplete canonical progression information."
      : modifierReview
        ? `${boundary === "phase1_modifier_review" ? "Phase 1" : "Phase 2"} modifiers are being reviewed.`
        : roundEndCheckpoint
          ? "Round-end work is complete. The GM must open the next round."
          : `Combat remains at ${BOUNDARY_LABELS[boundary]}.`,
    taskHeading: incomplete
      ? "Combat state incomplete"
      : modifierReview && waitingForGm
        ? "Waiting for GM modifier review"
        : roundEndCheckpoint && waitingForGm
          ? "Waiting for GM round-end review"
          : waitingForGm
            ? "Waiting for GM"
            : "Waiting for another participant",
    trackerFacet: position.trackerFacet.step,
  });
}

/** Compatibility for presentation fixtures and legacy projections created before board position. */
function legacyInitiativeWaitingPresentation(
  input: BuildCurrentActionPresentationInput,
): CurrentActionPresentation | undefined {
  if (input.viewer.kind !== "player") return undefined;
  const order = input.progression?.executionOrder;
  const currentValue = order?.currentInitiativeValue;
  if (currentValue === undefined) return undefined;
  const controlled = input.viewer.controlledParticipantIds ?? new Set<string>();
  const ownGroup = order?.initiativeGroups?.find((group) =>
    group.participantIds.some((participantId) => controlled.has(participantId)),
  );
  if (!ownGroup || ownGroup.status === "complete") return undefined;
  const sameGroup = ownGroup.status === "current";
  const summary = sameGroup
    ? `Your Initiative ${currentValue} action is recorded. Other Initiative ${currentValue} actions are still being resolved.`
    : `Initiative ${currentValue} is still being resolved. Your Initiative ${ownGroup.initiativeValue} action will open after Initiative ${currentValue} completes.`;
  return Object.freeze({
    actionName: "Initiative",
    boundary: input.progression?.boundary.kind ?? "declaration",
    encounterId: input.encounterId,
    encounterRevision: input.encounterRevision ?? "",
    heading: "Current action",
    primaryAction: {
      enabled: false,
      gmProxyAvailable: false,
      label: "Waiting",
      viewerMayInvoke: false,
    },
    reason: "",
    requiredActor: { hidden: true, label: "another combatant" },
    requiredNow: sameGroup
      ? `Waiting for other Initiative ${currentValue} actions.`
      : `Waiting for Initiative ${currentValue} to finish.`,
    status: "waiting",
    summary,
    taskHeading: "Waiting for initiative",
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
  const selectedTask = selectTask(taskList(input.progression), input.progression, input.viewer);
  if (
    input.progression.canonicalOperationalPosition &&
    input.progression.canonicalOperationalPosition.taskVisibility !== "visible" &&
    !selectedTask
  ) {
    return canonicalWaitingPresentation(input);
  }
  if (!input.progression.canonicalOperationalPosition) {
    const initiativeWaiting = legacyInitiativeWaitingPresentation(input);
    const controlled = input.viewer.controlledParticipantIds ?? new Set<string>();
    const hasInvokableControlledTask = taskList(input.progression).some(
      (task) =>
        task.state === "executable" &&
        task.owner?.kind === "combatant" &&
        controlled.has(task.owner.participantId) &&
        viewerMayInvokeTask(task, input.viewer),
    );
    if (initiativeWaiting && !hasInvokableControlledTask) return initiativeWaiting;
  }
  const task = selectedTask;
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
    actionId: task.identity.actionId,
    attackIndex: task.identity.attackIndex,
    attackModeId: task.identity.attackModeId,
    attackResultId: task.identity.attackResultId,
    attackerParticipantId: task.identity.attackerParticipantId,
    commandType: task.expectedCommand,
    criticalResultId: task.identity.criticalResultId,
    contestId: task.identity.contestId,
    continuedContactId: task.identity.continuedContactId,
    damageRollExpression: task.identity.damageRollExpression,
    damageReviewId: task.identity.damageReviewId,
    declarationId: task.identity.declarationId,
    declaredOpponentParticipantId: task.identity.declaredOpponentParticipantId,
    defenderParticipantId: task.identity.defenderParticipantId,
    disarmAttemptId: task.identity.disarmAttemptId,
    encounterId: input.encounterId,
    executionGroupId: task.executionGroupId,
    expectedBoundary: input.progression.boundary.kind,
    expectedRevision: input.encounterRevision,
    healthRollId: task.identity.healthRollId,
    hitLocationResultId: task.identity.hitLocationResultId,
    initiativeGroupId: task.identity.initiativeGroupId,
    initiativeValue: task.identity.initiativeValue,
    opponentParticipantId: task.identity.opponentParticipantId,
    opportunityId: task.identity.opportunityId,
    offensiveParryAttemptId: task.identity.offensiveParryAttemptId,
    observationAttemptId: task.identity.observationAttemptId,
    parryPurpose: task.identity.parryPurpose,
    parryResultId: task.identity.parryResultId,
    parrySourceId: task.identity.parrySourceId,
    pairId: task.identity.pairId,
    participantId:
      task.owner?.kind === "combatant" ? task.owner.participantId : task.identity.participantId,
    phase,
    processId: task.processId,
    proposalId: task.identity.proposalId,
    relationshipId: task.identity.relationshipId,
    rollPurpose: task.identity.rollPurpose,
    stageId: task.stageId,
    targetBoundary: task.transition?.targetBoundary,
    taskId: task.id,
    weaponInstanceId: task.identity.weaponInstanceId,
    weaponSourceId: task.identity.weaponSourceId,
    weaponSourceSlot: task.identity.weaponSourceSlot,
    weaponTemplateId: task.identity.weaponTemplateId,
  } satisfies CurrentActionCommandDescriptor);
  const waitingForParallelParticipantRoll =
    (task.kind === "offensive_parry_brawling_roll" ||
      task.kind === "continued_contact_maintenance_roll" ||
      task.kind === "break_off_escapee_roll" ||
      task.kind === "break_off_attacker_roll") &&
    input.viewer.kind === "player" &&
    !viewerMayInvoke &&
    (task.kind === "break_off_escapee_roll" || task.kind === "break_off_attacker_roll"
      ? [actor?.id, target?.id].some(
          (participantId) =>
            participantId !== undefined &&
            (input.viewer.controlledParticipantIds ?? new Set()).has(participantId),
        )
      : task.kind === "continued_contact_maintenance_roll"
        ? task.presentationContext?.opponentRollRecorded === true &&
          task.identity.opponentParticipantId !== undefined &&
          (input.viewer.controlledParticipantIds ?? new Set()).has(
            task.identity.opponentParticipantId,
          )
        : actor?.id !== undefined &&
          (input.viewer.controlledParticipantIds ?? new Set()).has(actor.id));
  const summary = waitingForParallelParticipantRoll
    ? `Your ${task.kind.startsWith("break_off_") ? "Dodge" : "Brawling"} roll is recorded. Waiting for ${required.label}.`
    : summaryFor({
        action,
        actor,
        supersededModifierReviewKeys: input.supersededModifierReviewKeys,
        target,
        task,
      });
  const requiredNow = waitingForParallelParticipantRoll
    ? `Waiting for ${required.label}.`
    : requiredNowFor(task, status, required.label);

  return Object.freeze({
    actionKind: task.presentationContext?.actionKind,
    actionName: action,
    actor,
    boundary: input.progression.boundary.kind,
    distance: task.presentationContext?.distance,
    damageRollExpression: task.presentationContext?.damageRollExpression,
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
      label: waitingLabel(task, viewerMayInvoke, required.label),
      viewerMayInvoke,
    },
    processId: task.processId,
    reason: task.presentationContext?.actionKind?.startsWith("continued_contact_")
      ? (task.presentationContext.reason ?? "")
      : "",
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
          label: weaponLabelFor(task, actor, task.presentationContext.weapon.label),
        }
      : undefined,
  });
}

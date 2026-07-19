import {
  canPlayerRollCombatInitiative,
  canPlayerSubmitCombatDeclaration,
  getCombatRoundPhaseInitiativeChoiceStatuses,
  isCombatRoundPhaseInitiativeComplete,
  isCombatStartExperienceRollRequired,
  type CombatRoundPhase,
  type CombatRoundStep,
} from "../combatRoundManager";
import {
  GM_IDENTITY,
  buildProcess,
  isCompleteStatus,
  type ProjectionBuildContext,
  type TaskDependency,
  type TaskSpec,
} from "./internal";
import type { CombatProgressionProcess } from "./types";

export function buildDeclarationProcesses(
  context: ProjectionBuildContext,
): CombatProgressionProcess[] {
  const combatExperienceTasks: TaskSpec[] = [];
  const declarationTasks: TaskSpec[] = [];
  let pendingDeclarationCount = 0;
  const experienceWindowOpen = context.state.combatExperienceDifficulty !== undefined;

  if (
    context.state.roundNumber === 1 &&
    context.state.participants.some((participant) =>
      isCombatStartExperienceRollRequired({
        participantId: participant.participantId,
        state: context.state,
      }),
    ) &&
    !experienceWindowOpen
  ) {
    combatExperienceTasks.push({
      allowedActors: ["gm"],
      expectedCommand: "set_combat_experience_difficulty",
      key: "difficulty",
      kind: "combat_experience",
      owner: GM_IDENTITY,
      trackerOwner: context.identities.get(context.state.currentCursor?.participantId ?? ""),
      trackerStep: "DE",
    });
  }

  for (const participant of context.state.participants) {
    const owner = context.identities.get(participant.participantId);
    const experienceRequired = isCombatStartExperienceRollRequired({
      participantId: participant.participantId,
      state: context.state,
    });
    if (experienceRequired) {
      combatExperienceTasks.push({
        dependencies: experienceWindowOpen
          ? undefined
          : [{ message: "The GM must open Combat Experience first.", type: "gm_commit_pending" }],
        expectedCommand: "roll_combat_experience",
        kind: "combat_experience",
        owner,
        trackerOwner: owner,
        trackerStep: "DE",
      });
    }

    const playerMaySubmit = canPlayerSubmitCombatDeclaration({
      participantId: participant.participantId,
      state: context.state,
    });
    if (playerMaySubmit || experienceRequired) {
      pendingDeclarationCount += 1;
      const dependencies: TaskDependency[] = [];
      if (experienceRequired) {
        dependencies.push({
          message: "Combat Experience must be resolved before declaration.",
          owner,
          type: "participant_input_pending",
        });
      }
      declarationTasks.push({
        dependencies,
        expectedCommand: "declare_action",
        kind: "submit_declaration",
        owner,
        trackerOwner: owner,
        trackerStep: "DE",
      });
    } else {
      // A submitted declaration remains editable by the GM while the DE boundary is open.
      declarationTasks.push({
        allowedActors: ["gm"],
        expectedCommand: "declare_action",
        key: `${participant.participantId}:gm-edit`,
        kind: "submit_declaration",
        owner,
        trackerOwner: owner,
        trackerStep: "DE",
      });
    }
  }

  const processes: CombatProgressionProcess[] = [];
  if (combatExperienceTasks.length > 0) {
    processes.push(
      buildProcess(context, "combat_experience", [
        {
          kind: experienceWindowOpen ? "input" : "difficulty",
          state: "active",
          strategy: experienceWindowOpen ? "parallel_all" : "gm_review",
          tasks: combatExperienceTasks,
        },
      ]),
    );
  }
  processes.push(
    buildProcess(context, "declaration", [
      {
        kind: "input",
        state: pendingDeclarationCount > 0 ? "active" : "complete",
        strategy: "parallel_all",
        tasks: declarationTasks,
      },
      {
        kind: "boundary",
        state:
          pendingDeclarationCount === 0 && combatExperienceTasks.length === 0
            ? "active"
            : "pending",
        strategy: "gm_review",
        tasks:
          pendingDeclarationCount === 0 && combatExperienceTasks.length === 0
            ? [
                {
                  allowedActors: ["gm"],
                  expectedCommand: "advance_boundary",
                  kind: "gm_advance_boundary",
                  owner: GM_IDENTITY,
                  trackerOwner: context.identities.get(
                    context.state.currentCursor?.participantId ?? "",
                  ),
                  trackerStep: "DE",
                },
              ]
            : [],
      },
    ]),
  );
  return processes;
}

export function buildModifierReviewProcess(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
): CombatProgressionProcess {
  const step: CombatRoundStep =
    phase === "phase1" ? "review_action_modifiers" : "review_phase_2_modifiers";
  const trackerStep = phase === "phase1" ? "M1" : "M2";
  const expectedCommand =
    phase === "phase1" ? "review_modifiers_phase1" : "review_modifiers_phase2";
  const pending = context.state.participants.filter(
    (participant) => !isCompleteStatus(participant.stepStatuses[step]),
  );
  const activeId = context.state.currentCursor?.participantId;
  const tasks = pending.map<TaskSpec>((participant) => {
    const owner = context.identities.get(participant.participantId);
    return {
      allowedActors: ["gm"],
      dependencies:
        participant.participantId === activeId
          ? undefined
          : [
              {
                message: "An earlier ordered modifier review is pending.",
                type: "gm_commit_pending",
              },
            ],
      expectedCommand,
      kind: "modifier_review",
      owner,
      trackerOwner: owner,
      trackerStep,
    };
  });

  return buildProcess(context, "modifier_review", [
    {
      kind: "review",
      state: tasks.length > 0 ? "active" : "complete",
      strategy: "ordered_all",
      tasks,
    },
    {
      kind: "boundary",
      state: tasks.length === 0 ? "active" : "pending",
      strategy: "gm_review",
      tasks:
        tasks.length === 0
          ? [
              {
                allowedActors: ["gm"],
                expectedCommand: "advance_boundary",
                kind: "gm_advance_boundary",
                owner: GM_IDENTITY,
                trackerStep,
              },
            ]
          : [],
    },
  ]);
}

export function buildInitiativeProcess(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
): CombatProgressionProcess {
  const trackerStep = phase === "phase1" ? "i1" : "i2";
  const command = phase === "phase1" ? "roll_initiative_phase1" : "roll_initiative_phase2";
  const initiativeTasks = context.state.participants.flatMap<TaskSpec>((participant) => {
    if (
      isCompleteStatus(
        participant.stepStatuses[phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2"],
      ) ||
      participant.initiatives[phase]
    )
      return [];
    const owner = context.identities.get(participant.participantId);
    return [
      {
        dependencies: canPlayerRollCombatInitiative({
          participantId: participant.participantId,
          phase,
          state: context.state,
        })
          ? undefined
          : [
              {
                message: "The initiative roll window is not open for this combatant.",
                type: "participant_input_pending",
              },
            ],
        expectedCommand: command,
        identity: { phase },
        kind: "roll_initiative",
        owner,
        trackerOwner: owner,
        trackerStep,
      },
    ];
  });
  const complete = isCombatRoundPhaseInitiativeComplete({ phase, state: context.state });
  const choiceTasks = complete
    ? getCombatRoundPhaseInitiativeChoiceStatuses({ phase, state: context.state })
        .filter((status) => status.unresolved)
        .map<TaskSpec>((status) => {
          const owner = context.identities.get(status.participantId);
          return {
            expectedCommand: "submit_phase_initiative_choice",
            identity: { phase },
            key: `${status.participantId}:choice`,
            kind: "combat_experience",
            owner,
            trackerOwner: owner,
            trackerStep,
          };
        })
    : [];
  const commitTasks: TaskSpec[] = complete
    ? [
        {
          allowedActors: ["gm"],
          expectedCommand: "commit_phase_initiative_resolution",
          identity: { phase },
          kind: "commit_initiative",
          owner: GM_IDENTITY,
          trackerOwner: context.identities.get(context.state.currentCursor?.participantId ?? ""),
          trackerStep,
        },
      ]
    : [];

  return buildProcess(context, "initiative", [
    {
      kind: "roll",
      state: complete ? "complete" : "active",
      strategy: "initiative_groups",
      tasks: initiativeTasks,
    },
    {
      kind: "input",
      state: complete && choiceTasks.length > 0 ? "active" : complete ? "complete" : "pending",
      strategy: "parallel_all",
      tasks: choiceTasks,
    },
    {
      kind: "commit",
      state: complete ? "active" : "pending",
      strategy: "gm_review",
      tasks: commitTasks,
    },
  ]);
}

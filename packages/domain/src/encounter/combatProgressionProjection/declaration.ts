import {
  canPlayerRollCombatInitiative,
  canPlayerSubmitCombatDeclaration,
  getCombatRoundCombatExperienceDifficulty,
  isCombatRoundPhaseInitiativeComplete,
  isCombatStartExperienceRollRequired,
  type CombatRoundPhase,
  type CombatRoundStep,
} from "../combatRoundManager";
import {
  GM_IDENTITY,
  buildProcess,
  getCombatProgressionBoundaryTarget,
  getCombatProgressionProcessId,
  isCompleteStatus,
  type ProjectionBuildContext,
  type TaskDependency,
  type TaskSpec,
} from "./internal";
import type { CombatProgressionProcess } from "./types";

function isSuppressedNoWork(input: {
  context: ProjectionBuildContext;
  participantId: string;
  phase: CombatRoundPhase;
  processFamily: "initiative";
}): boolean {
  const fact = input.context.participation?.facts.find(
    (candidate) =>
      candidate.identity.processFamily === input.processFamily &&
      candidate.identity.participantId === input.participantId &&
      candidate.identity.phase === input.phase,
  );
  return Boolean(
    fact &&
    fact.status === "not_required" &&
    fact.workClass === "no_work" &&
    fact.completeness === "complete",
  );
}

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
        presentationContext: {
          actor: owner,
          difficulty: getCombatRoundCombatExperienceDifficulty(context.state),
          responder: owner,
        },
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
                  expectedCommand: "advance_combat_boundary",
                  kind: "gm_advance_boundary",
                  owner: GM_IDENTITY,
                  trackerStep: "DE",
                  transition: {
                    currentBoundary: context.boundaryKind,
                    requiredCompletedProcessIds: [
                      getCombatProgressionProcessId(context, "declaration"),
                    ],
                    targetBoundary: getCombatProgressionBoundaryTarget(context.boundaryKind)!,
                  },
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
  actionDecisionProcesses: readonly CombatProgressionProcess[] = [],
): CombatProgressionProcess {
  const step: CombatRoundStep =
    phase === "phase1" ? "review_action_modifiers" : "review_phase_2_modifiers";
  const trackerStep = phase === "phase1" ? "M1" : "M2";
  const expectedCommand =
    phase === "phase1" ? "review_modifiers_phase1" : "review_modifiers_phase2";
  const pending = context.state.participants.filter(
    (participant) => !isCompleteStatus(participant.stepStatuses[step]),
  );
  // Each modifier-review boundary owns a fresh ordered participant iteration. A compatibility
  // cursor left by declaration, action resolution, or a Double Attack decision must not seed it.
  const activeId = pending[0]?.participantId;
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
      identity: { phase },
      kind: "modifier_review",
      owner,
      presentationContext: { actor: owner },
      trackerOwner: owner,
      trackerStep,
    };
  });
  const pendingActionDecision = actionDecisionProcesses.some((process) =>
    process.stages.some((stage) => stage.state !== "complete"),
  );
  const boundaryReady = tasks.length === 0 && !pendingActionDecision;

  return buildProcess(context, "modifier_review", [
    {
      kind: "review",
      state: tasks.length > 0 ? "active" : "complete",
      strategy: "ordered_all",
      executionGroups: tasks.map((task) => ({
        position: context.state.participants.findIndex(
          (participant) =>
            task.owner?.kind === "combatant" &&
            participant.participantId === task.owner.participantId,
        ),
        strategy: "ordered_all" as const,
        tasks: [task],
      })),
    },
    {
      kind: "boundary",
      state: boundaryReady ? "active" : "pending",
      strategy: "gm_review",
      tasks: boundaryReady
        ? [
            {
              allowedActors: ["gm"],
              expectedCommand: "advance_combat_boundary",
              kind: "gm_advance_boundary",
              owner: GM_IDENTITY,
              trackerStep,
              transition: {
                currentBoundary: context.boundaryKind,
                requiredCompletedProcessIds: [
                  getCombatProgressionProcessId(context, "modifier_review"),
                  ...actionDecisionProcesses.map((process) => process.id),
                ],
                targetBoundary: getCombatProgressionBoundaryTarget(context.boundaryKind)!,
              },
            },
          ]
        : [],
    },
  ]);
}

export function buildModifierReviewProcesses(
  context: ProjectionBuildContext,
  phase: CombatRoundPhase,
): CombatProgressionProcess[] {
  const actionDecisionProcesses =
    phase === "phase2"
      ? context.actionProcessPlans.flatMap<CombatProgressionProcess>((plan) => {
          const gate = plan.decisionGate;
          if (!gate?.required) return [];
          const owner = context.identities.get(gate.ownerParticipantId);
          return [
            buildProcess(
              context,
              "attack_decision",
              [
                {
                  kind: "decision",
                  state: gate.state === "complete" ? "complete" : "active",
                  strategy: "single_task",
                  tasks:
                    gate.state === "ready"
                      ? [
                          {
                            expectedCommand: "decide_double_attack_phase2",
                            identity: {
                              opportunityId: gate.opportunityId,
                              phase: "phase2",
                            },
                            key: gate.id,
                            kind: "double_attack_decision",
                            owner,
                            presentationContext: {
                              actionKind: "double_attack",
                              actor: owner,
                              responder: owner,
                              target: context.identities.get(
                                context.state.participants.find(
                                  (participant) =>
                                    participant.participantId === gate.ownerParticipantId,
                                )?.declaration?.phaseContexts?.phase2?.targetParticipantId ?? "",
                              ),
                            },
                            trackerOwner: owner,
                            trackerStep: "M2",
                          },
                        ]
                      : [],
                },
              ],
              { key: gate.ownerParticipantId, planId: plan.id },
            ),
          ];
        })
      : [];

  return [
    ...actionDecisionProcesses,
    buildModifierReviewProcess(context, phase, actionDecisionProcesses),
  ];
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
    if (
      isSuppressedNoWork({
        context,
        participantId: participant.participantId,
        phase,
        processFamily: "initiative",
      })
    ) {
      return [];
    }
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
  const complete = context.participation
    ? initiativeTasks.length === 0
    : isCombatRoundPhaseInitiativeComplete({ phase, state: context.state });
  const commitTasks: TaskSpec[] = complete
    ? [
        {
          allowedActors: ["gm"],
          expectedCommand: "commit_phase_initiative_resolution",
          identity: { phase },
          kind: "commit_initiative",
          owner: GM_IDENTITY,
          trackerStep,
        },
      ]
    : [];

  return buildProcess(context, "initiative", [
    {
      kind: "roll",
      state: complete ? "complete" : "active",
      strategy: "initiative_groups",
      executionGroups: initiativeTasks.map((task) => ({
        position: context.state.participants.findIndex(
          (participant) =>
            task.owner?.kind === "combatant" &&
            participant.participantId === task.owner.participantId,
        ),
        strategy: "initiative_groups" as const,
        tasks: [task],
      })),
    },
    {
      // Phase choices and CE are derived only after the GM commits initiative and the action
      // boundary opens. The empty compatibility stage keeps initiative process identity stable.
      kind: "input",
      state: complete ? "complete" : "pending",
      strategy: "parallel_all",
      tasks: [],
    },
    {
      kind: "commit",
      state: complete ? "active" : "pending",
      strategy: "gm_review",
      tasks: commitTasks,
    },
  ]);
}

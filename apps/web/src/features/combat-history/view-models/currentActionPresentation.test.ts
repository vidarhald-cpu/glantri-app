import type {
  CombatProgressionBoundaryKind,
  CombatProgressionExpectedCommand,
  CombatProgressionPresentationProjection,
  CombatProgressionPresentationTask,
  CombatProgressionTaskKind,
} from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  buildCurrentActionPresentation,
  labelCurrentActionAsDeclarationEdit,
} from "./currentActionPresentation";

const aria = { kind: "combatant" as const, label: "Aria", participantId: "aria" };
const borin = { kind: "combatant" as const, label: "Borin", participantId: "borin" };

function task(input: {
  actionKind?: string;
  actor?: typeof aria | typeof borin;
  command?: CombatProgressionExpectedCommand;
  currentDistance?: number;
  difficulty?: number;
  gmOnly?: boolean;
  id?: string;
  kind: CombatProgressionTaskKind;
  owner?: typeof aria | typeof borin;
  phase?: "phase1" | "phase2";
  reason?: string;
  requestedDistance?: number;
  responder?: typeof aria | typeof borin;
  state?: "executable" | "waiting";
  target?: typeof aria | typeof borin;
  weaponLabel?: string;
}): CombatProgressionPresentationTask {
  const owner = input.gmOnly
    ? ({ id: "gm", kind: "gm", label: "Game Master" } as const)
    : (input.owner ?? aria);
  return {
    actorAccess: { combatant: !input.gmOnly, gm: true },
    contributesToProgression: true,
    executionGroupId: `group:${input.id ?? input.kind}`,
    expectedCommand: input.command ?? "roll_attack",
    id: input.id ?? `task:${input.kind}`,
    identity: {
      attackResultId: input.kind === "parry" ? "attack-result-1" : undefined,
      executionGroupId: `group:${input.id ?? input.kind}`,
      opportunityId: "opportunity-1",
      opponentParticipantId:
        input.kind === "parry" ? input.actor?.participantId : input.target?.participantId,
      pairId: input.kind.startsWith("adjust_distance") ? "aria::borin" : undefined,
      phase: input.phase ?? "phase1",
      proposalId: input.kind.includes("feint")
        ? "proposal-feint"
        : input.kind.startsWith("adjust_distance")
          ? "proposal-distance"
          : undefined,
    },
    kind: input.kind,
    opponent: input.kind === "parry" ? input.actor : input.target,
    owner,
    presentationContext: {
      actionKind: input.actionKind,
      actor: input.actor ?? (owner.kind === "combatant" ? owner : undefined),
      distance:
        input.currentDistance !== undefined || input.requestedDistance !== undefined
          ? { current: input.currentDistance, requested: input.requestedDistance }
          : undefined,
      difficulty: input.difficulty,
      reason: input.reason,
      responder: input.responder,
      target: input.target,
      weapon: input.weaponLabel ? { id: "weapon-1", label: input.weaponLabel } : undefined,
    },
    processId: `process:${input.kind}`,
    stageId: `stage:${input.kind}`,
    state: input.state ?? "executable",
    trackerFacet: {
      owner: owner.kind === "combatant" ? owner : input.actor,
      step: input.phase === "phase2" ? "A2" : "A1",
    },
  };
}

function progression(
  input: {
    awaitingGmTransition?: boolean;
    boundary?: CombatProgressionBoundaryKind;
    conflicted?: boolean;
    tasks?: readonly CombatProgressionPresentationTask[];
  } = {},
): CombatProgressionPresentationProjection {
  const tasks = input.tasks ?? [];
  const boundary = input.boundary ?? "phase1_resolution";
  return {
    awaitingGmTransition: input.awaitingGmTransition ?? false,
    boundary: { id: `boundary:${boundary}`, kind: boundary, roundNumber: 2 },
    processes: tasks.length
      ? [
          {
            id: "process",
            kind: "attack",
            stages: [
              {
                executionGroups: tasks.map((candidate, position) => ({
                  activationBoundary: {
                    id: `boundary:${boundary}`,
                    kind: boundary,
                    roundNumber: 2,
                  },
                  blocked: candidate.state === "waiting",
                  completionState: "incomplete",
                  executionStrategy: "single_task",
                  futureActivationBoundary: undefined,
                  id: candidate.executionGroupId,
                  position,
                  stageId: candidate.stageId,
                  tasks: [candidate],
                })),
                executionStrategy: "single_task",
                id: "stage",
                kind: "attack",
                processId: "process",
                state: "active",
                tasks,
              },
            ],
          },
        ]
      : [],
    roundNumber: 2,
    taskVisibility: input.conflicted ? "conflicted" : "available",
  };
}

function build(
  tasks: readonly CombatProgressionPresentationTask[],
  viewer: "gm" | "player" = "gm",
) {
  return buildCurrentActionPresentation({
    encounterId: "encounter-1",
    encounterRevision: "2026-07-20T12:00:00.000Z",
    progression: progression({ tasks }),
    viewer:
      viewer === "gm"
        ? { kind: "gm" }
        : { controlledParticipantIds: new Set(["aria"]), kind: "player" },
  });
}

describe("CurrentActionPresentation", () => {
  it("binds an enriched attack to its revision, task, opportunity, and command", () => {
    const result = build([
      task({
        actionKind: "single_attack",
        actor: aria,
        command: "roll_attack",
        kind: "attack",
        target: borin,
        weaponLabel: "Long Sword",
      }),
    ]);

    expect(result).toMatchObject({
      actionName: "Single Attack",
      actor: { id: "aria", label: "Aria" },
      boundary: "phase1_resolution",
      encounterRevision: "2026-07-20T12:00:00.000Z",
      heading: "Phase 1",
      primaryAction: {
        descriptor: {
          commandType: "roll_attack",
          expectedRevision: "2026-07-20T12:00:00.000Z",
          opportunityId: "opportunity-1",
          taskId: "task:attack",
        },
        label: "Roll attack",
      },
      target: { id: "borin", label: "Borin" },
      taskHeading: "Roll attack",
      weapon: { label: "Long Sword" },
    });
    expect(result?.summary).toBe("Aria is attacking Borin.");
    expect(result?.requiredNow).toBe("Roll attack.");
    expect(result?.reason).toBe("");
    expect(result?.expectedNextProcess).toBeUndefined();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.primaryAction.descriptor)).toBe(true);
  });

  it("presents parry with the attacker, defender, and direct required action", () => {
    const result = build(
      [
        task({
          actor: borin,
          command: "roll_parry",
          kind: "parry",
          owner: aria,
          responder: aria,
          target: aria,
        }),
      ],
      "player",
    );

    expect(result?.heading).toBe("Phase 1");
    expect(result?.summary).toBe("Borin hit Aria.");
    expect(result?.requiredActor.label).toBe("Aria");
    expect(result?.primaryAction.label).toBe("Roll parry");
    expect(result?.requiredNow).toBe("Defend against the attack.");
    expect(result?.primaryAction.descriptor).toMatchObject({
      attackResultId: "attack-result-1",
      executionGroupId: expect.stringContaining("group:"),
      opponentParticipantId: "borin",
      participantId: "aria",
      phase: "phase1",
    });
  });

  it("keeps the attacker in the live parry context without exposing a defense command", () => {
    const parryTask = task({
      actor: borin,
      command: "roll_parry",
      kind: "parry",
      owner: aria,
      responder: aria,
      target: aria,
    });
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-20T12:00:00.000Z",
      progression: progression({ tasks: [parryTask] }),
      viewer: { controlledParticipantIds: new Set(["borin"]), kind: "player" },
    });

    expect(result).toMatchObject({
      primaryAction: {
        enabled: false,
        label: "Waiting for another combatant",
        viewerMayInvoke: false,
      },
      requiredNow: "Waiting for another combatant.",
      summary: "Borin hit Aria.",
      taskKind: "parry",
    });
    expect(result?.primaryAction.descriptor).toBeUndefined();
  });

  it.each([
    ["feint_attacker_roll", "Roll Feint", "Roll Feint."],
    ["feint_defender_roll", "Roll Feint resistance", "Roll Feint resistance."],
    ["feint_commit", "Commit Feint result", "Commit the Feint result."],
  ] as const)("presents %s from the canonical Feint task", (kind, button, requiredNow) => {
    const gmOnly = kind === "feint_commit";
    const result = build([
      task({
        actionKind: "feint_attack",
        actor: aria,
        command: gmOnly ? "commit_feint_result" : "roll_feint",
        gmOnly,
        kind,
        owner: gmOnly ? undefined : kind === "feint_defender_roll" ? borin : aria,
        responder: kind === "feint_defender_roll" ? borin : aria,
        target: borin,
      }),
    ]);

    expect(result?.actionName).toBe("Feint-Attack");
    expect(result?.summary).toBe("Aria is attempting to feint Borin.");
    expect(result?.requiredNow).toBe(requiredNow);
    expect(result?.primaryAction.label).toBe(button);
    expect(result?.primaryAction.descriptor?.proposalId).toBe("proposal-feint");
  });

  it.each([
    ["adjust_distance_response", "Choose whether to oppose"],
    ["adjust_distance_adjustment", "Confirm Dodge adjustment"],
    ["adjust_distance_attacker_roll", "Roll Dodge"],
    ["adjust_distance_defender_roll", "Roll Dodge"],
    ["adjust_distance_commit", "Apply distance"],
  ] as const)("presents %s with canonical distance context", (kind, button) => {
    const gmOnly = kind === "adjust_distance_adjustment" || kind === "adjust_distance_commit";
    const command =
      kind === "adjust_distance_response"
        ? "respond_adjust_distance"
        : kind === "adjust_distance_adjustment"
          ? "review_adjust_distance_roll_adjustment"
          : kind === "adjust_distance_commit"
            ? "commit_adjust_distance"
            : "roll_adjust_distance";
    const result = build([
      task({
        actionKind: "adjust_distance_attack",
        actor: aria,
        command,
        currentDistance: 3,
        gmOnly,
        kind,
        responder: kind.includes("defender") || kind.endsWith("response") ? borin : aria,
        requestedDistance: 2,
        target: borin,
      }),
    ]);

    expect(result?.summary).toBe("Aria is attempting to move closer.");
    expect(result?.distance).toEqual({ current: 3, requested: 2 });
    expect(result?.primaryAction.label).toBe(button);
    expect(result?.primaryAction.enabled).toBe(true);
    expect(result?.primaryAction.viewerMayInvoke).toBe(true);
    if (kind === "adjust_distance_commit") {
      expect(result?.requiredNow).toBe("Apply the distance.");
    }
    expect(result?.primaryAction.descriptor).toMatchObject({
      commandType: command,
      expectedRevision: "2026-07-20T12:00:00.000Z",
      pairId: "aria::borin",
      proposalId: "proposal-distance",
      taskId: `task:${kind}`,
    });
  });

  it("shows an involved player the resolved Adjust Distance contest while withholding its GM command", () => {
    const commitTask = task({
      actionKind: "adjust_distance_attack",
      actor: aria,
      command: "commit_adjust_distance",
      currentDistance: 3,
      gmOnly: true,
      kind: "adjust_distance_commit",
      requestedDistance: 2,
      target: borin,
    });
    const player = build([commitTask], "player");
    const defender = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-20T12:00:00.000Z",
      progression: progression({ tasks: [commitTask] }),
      viewer: { controlledParticipantIds: new Set(["borin"]), kind: "player" },
    });
    const gmPlayer = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-20T12:00:00.000Z",
      progression: progression({ tasks: [commitTask] }),
      viewer: {
        controlledParticipantIds: new Set(["aria"]),
        kind: "player",
        mayProxy: true,
      },
    });

    expect(player).toMatchObject({
      primaryAction: {
        enabled: false,
        label: "Waiting for GM",
        viewerMayInvoke: false,
      },
      requiredNow: "Waiting for GM.",
      summary: "Aria is attempting to move closer.",
      taskKind: "adjust_distance_commit",
    });
    expect(player?.primaryAction.descriptor).toBeUndefined();
    expect(defender).toMatchObject({
      primaryAction: { viewerMayInvoke: false },
      requiredNow: "Waiting for GM.",
      summary: "Aria is attempting to move closer.",
    });
    expect(defender?.primaryAction.descriptor).toBeUndefined();
    expect(gmPlayer).toEqual(player);
  });

  it("presents the Double Attack decision without future-work explanation", () => {
    const result = build([
      task({
        actionKind: "double_attack",
        actor: aria,
        command: "decide_double_attack_phase2",
        kind: "double_attack_decision",
        target: borin,
      }),
    ]);

    expect(result?.summary).toBe("Aria has completed the first attack.");
    expect(result?.requiredNow).toBe("Choose Continue or Cancel.");
    expect(result?.primaryAction.label).toBe("Choose Continue or Cancel");
  });

  it.each([
    ["combat_experience", "Roll Combat Experience", "Combat Experience"],
    ["health_review", "Roll Health", "Health Review"],
    ["distance_roll", "Roll distance control", "Distance Control"],
    ["effect_review", "Complete effect review", "Effect Review"],
    ["round_end_prepare", "Begin round end", "Round End"],
  ] as const)("presents %s without consulting prior results", (kind, button, action) => {
    const result = build([
      task({
        actor: aria,
        command:
          kind === "health_review"
            ? "roll_round_end_health_check"
            : kind === "distance_roll"
              ? "roll_round_end_distance_control"
              : kind === "round_end_prepare"
                ? "prepare_round_end_review"
                : kind === "effect_review"
                  ? "commit_round_end_participant_review"
                  : "roll_combat_experience",
        gmOnly: kind === "effect_review" || kind === "round_end_prepare",
        kind,
        reason: kind === "health_review" ? "Bleeding requires review." : undefined,
      }),
    ]);

    expect(result?.actionName).toBe(action);
    expect(result?.primaryAction.label).toBe(button);
    expect(result?.reason).toBe("");
  });

  it("includes the canonical Combat Experience difficulty", () => {
    const result = build([
      task({
        actor: aria,
        command: "roll_combat_experience",
        difficulty: 26,
        kind: "combat_experience",
      }),
    ]);

    expect(result?.difficulty).toBe(26);
    expect(result?.summary).toBe("Aria needs a Combat Experience roll.");
    expect(result?.requiredNow).toBe("Roll Combat Experience.");
  });

  it("presents an explicit GM boundary transition and immutable target", () => {
    const transitionTask = {
      ...task({
        command: "advance_combat_boundary",
        gmOnly: true,
        kind: "gm_advance_boundary",
      }),
      transition: {
        currentBoundary: "phase1_resolution" as const,
        requiredCompletedProcessIds: ["attack-process"],
        targetBoundary: "phase2_modifier_review" as const,
      },
    };
    const result = build([transitionTask]);

    expect(result?.heading).toBe("Phase 1");
    expect(result?.summary).toBe("Phase 1 is complete.");
    expect(result?.requiredNow).toBe("Open Phase 2 modifier review.");
    expect(result?.primaryAction.label).toBe("Open Phase 2");
    expect(result?.primaryAction.descriptor?.targetBoundary).toBe("phase2_modifier_review");
    expect(result?.requiredActor.label).toBe("GM");
    expect(result?.reason).toBe("");
  });

  it("shows player-safe Waiting for GM without exposing the hidden GM task descriptor", () => {
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-2",
      progression: progression({ awaitingGmTransition: true, tasks: [] }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      heading: "Phase 1",
      primaryAction: { enabled: false, label: "Waiting for GM" },
      requiredActor: { label: "GM" },
      requiredNow: "Waiting for GM.",
      status: "awaiting_gm",
      summary: "Phase 1 is complete.",
    });
    expect(result?.primaryAction).not.toHaveProperty("descriptor");
  });

  it("shows Waiting for another combatant when the visible task belongs to someone else", () => {
    const result = build(
      [task({ actor: borin, kind: "attack", owner: borin, target: aria })],
      "player",
    );

    expect(result?.status).toBe("waiting");
    expect(result?.requiredNow).toBe("Waiting for another combatant.");
    expect(result?.primaryAction).toMatchObject({
      enabled: false,
      label: "Waiting for another combatant",
      viewerMayInvoke: false,
    });
  });

  it("uses hidden-identity wording without exposing a private id or calculation", () => {
    const hiddenAttack = task({
      actor: borin,
      command: "roll_parry",
      kind: "parry",
      owner: aria,
      responder: aria,
      target: aria,
    });
    const safeTask = {
      ...hiddenAttack,
      identity: { ...hiddenAttack.identity, opponentParticipantId: undefined },
      opponent: undefined,
      presentationContext: {
        ...hiddenAttack.presentationContext,
        actor: undefined,
      },
    };
    const result = build([safeTask], "player");

    expect(result?.actor).toEqual({ hidden: true, label: "another combatant" });
    expect(JSON.stringify(result)).not.toContain("borin");
    expect(JSON.stringify(result)).not.toContain("rollD20");
    expect(JSON.stringify(result)).not.toContain("notes");
  });

  it("selects by viewer participant without changing shared task semantics", () => {
    const ariaTask = task({ id: "aria-task", kind: "attack", owner: aria, target: borin });
    const borinTask = task({ id: "borin-task", kind: "attack", owner: borin, target: aria });
    const sharedProgression = progression({ tasks: [borinTask, ariaTask] });
    const player = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-1",
      progression: sharedProgression,
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });
    const gmPlayer = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-1",
      progression: sharedProgression,
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player", mayProxy: true },
    });

    expect(player?.taskId).toBe("aria-task");
    expect(gmPlayer?.taskId).toBe(player?.taskId);
    expect(gmPlayer?.heading).toBe(player?.heading);
  });

  it("changes only when the accepted revision or projected task changes", () => {
    const firstTask = task({ id: "first", kind: "attack", target: borin });
    const first = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-1",
      progression: progression({ tasks: [firstTask] }),
      viewer: { kind: "gm" },
    });
    const repeated = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-1",
      progression: progression({ tasks: [firstTask] }),
      viewer: { kind: "gm" },
    });
    const changed = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-2",
      progression: progression({ tasks: [task({ id: "second", kind: "parry", owner: borin })] }),
      viewer: { kind: "gm" },
    });

    expect(repeated).toEqual(first);
    expect(changed?.taskId).toBe("second");
    expect(changed?.encounterRevision).toBe("revision-2");
  });

  it("is independent of local inspector, historical, CE, Dodge, maneuver, and latest-event state", () => {
    const canonical = build([task({ kind: "attack", target: borin })]);
    const unrelatedLocalState = {
      historicalRound: 1,
      inspectorParticipantId: "borin",
      latestEvent: "old-feint",
      previousCombatExperience: "old-ce",
      previousDodge: "old-dodge",
    };

    expect(canonical?.taskKind).toBe("attack");
    expect(JSON.stringify(canonical)).not.toContain(unrelatedLocalState.latestEvent);
    expect(JSON.stringify(canonical)).not.toContain(unrelatedLocalState.previousCombatExperience);
    expect(JSON.stringify(canonical)).not.toContain(unrelatedLocalState.previousDodge);
  });

  it("fails closed when relevant progression is conflicted", () => {
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-1",
      progression: progression({ conflicted: true }),
      viewer: { kind: "gm" },
    });

    expect(result).toMatchObject({
      primaryAction: { enabled: false, label: "Action unavailable" },
      requiredNow: "Waiting for GM.",
      summary: "Combat information is temporarily unavailable.",
      status: "conflicted",
    });
  });

  it.each([
    [
      "submit_declaration",
      "Choose your action for this round.",
      "Declare your action.",
      "Declare action",
    ],
    ["roll_initiative", "Initiative is open for Aria.", "Roll initiative.", "Roll initiative"],
    ["commit_initiative", "Initiative is complete.", "Commit initiative.", "Commit initiative"],
    ["health_review", "Aria needs a Health roll.", "Roll Health.", "Roll Health"],
  ] as const)("uses minimal in-game wording for %s", (kind, summary, requiredNow, button) => {
    const result = build([task({ actor: aria, kind })]);

    expect(result).toMatchObject({ summary, requiredNow, primaryAction: { label: button } });
  });

  it("labels a matching GM declaration edit without retargeting its descriptor", () => {
    const presentation = build([task({ actor: aria, kind: "submit_declaration" })]);
    const edited = labelCurrentActionAsDeclarationEdit({
      participantId: "aria",
      presentation,
    });

    expect(edited).toMatchObject({
      primaryAction: {
        descriptor: presentation?.primaryAction.descriptor,
        label: "Update declaration",
      },
      requiredNow: "Update the declaration.",
    });
    expect(labelCurrentActionAsDeclarationEdit({ participantId: "borin", presentation })).toBe(
      presentation,
    );
  });

  it("does not expose progression terminology in rendered presentation copy", () => {
    const transitionTask = {
      ...task({ command: "advance_combat_boundary", gmOnly: true, kind: "gm_advance_boundary" }),
      transition: {
        currentBoundary: "declaration" as const,
        requiredCompletedProcessIds: ["declaration-process"],
        targetBoundary: "phase1_modifier_review" as const,
      },
    };
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-1",
      progression: progression({ boundary: "declaration", tasks: [transitionTask] }),
      viewer: { kind: "gm" },
    });
    const visibleCopy = [
      result?.heading,
      result?.summary,
      result?.requiredNow,
      result?.primaryAction.label,
    ].join(" ");

    expect(visibleCopy).toBe(
      "Declaration Declarations are complete. Open Phase 1 modifier review. Open Phase 1",
    );
    expect(visibleCopy).not.toMatch(
      /boundary|canonical|child work|execution group|progression|proposal|stage|task/i,
    );
  });

  it("uses concise GM modifier-review wording", () => {
    const result = build([
      task({
        actor: aria,
        command: "review_modifiers_phase1",
        gmOnly: true,
        kind: "modifier_review",
      }),
    ]);

    expect(result).toMatchObject({
      heading: "Phase 1",
      primaryAction: { label: "Complete modifier review" },
      requiredNow: "Complete modifier review.",
      summary: "Phase 1 modifiers are ready for review.",
    });
  });

  it("keeps Phase 2 modifier-review heading, summary, and command on the same task phase", () => {
    const modifierTask = task({
      actor: aria,
      command: "review_modifiers_phase2",
      gmOnly: true,
      kind: "modifier_review",
      phase: "phase2",
    });
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-2",
      progression: progression({
        boundary: "phase2_modifier_review",
        tasks: [modifierTask],
      }),
      viewer: { kind: "gm" },
    });

    expect(result).toMatchObject({
      heading: "Phase 2",
      phase: "phase2",
      primaryAction: {
        descriptor: { commandType: "review_modifiers_phase2", taskId: modifierTask.id },
        enabled: true,
      },
      summary: "Phase 2 modifiers are ready for review.",
    });
  });

  it.each([
    [
      "phase2_resolution",
      "round_end",
      "Phase 2",
      "Phase 2 is complete.",
      "Begin round end.",
      "Begin round end",
    ],
    [
      "round_end",
      "round_boundary",
      "Round end",
      "The round is complete.",
      "Start the next round.",
      "Start next round",
    ],
  ] as const)(
    "uses concise GM wording from %s to %s",
    (currentBoundary, targetBoundary, heading, summary, requiredNow, button) => {
      const transitionTask = {
        ...task({ command: "advance_combat_boundary", gmOnly: true, kind: "gm_advance_boundary" }),
        transition: {
          currentBoundary,
          requiredCompletedProcessIds: ["completed-process"],
          targetBoundary,
        },
      };
      const result = buildCurrentActionPresentation({
        encounterId: "encounter-1",
        encounterRevision: "revision-1",
        progression: progression({ boundary: currentBoundary, tasks: [transitionTask] }),
        viewer: { kind: "gm" },
      });

      expect(result).toMatchObject({
        heading,
        primaryAction: { label: button },
        requiredNow,
        summary,
      });
    },
  );
});

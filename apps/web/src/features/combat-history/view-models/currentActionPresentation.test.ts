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
  resolveCombatTaskCommandContext,
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
    automation: {
      authority: { kind: "unknown" },
      eligibility: "unsupported",
      schemaVersion: 1,
      taskId: input.id ?? `task:${input.kind}`,
      warnings: [],
      workClass: "not_applicable",
    },
    contributesToProgression: true,
    executionGroupId: `group:${input.id ?? input.kind}`,
    expectedCommand: input.command ?? "roll_attack",
    id: input.id ?? `task:${input.kind}`,
    identity: {
      attackResultId: [
        "parry",
        "hit_location",
        "critical",
        "damage_roll",
        "damage_review",
      ].includes(input.kind)
        ? "attack-result-1"
        : undefined,
      attackerParticipantId: ["hit_location", "critical", "damage_roll", "damage_review"].includes(
        input.kind,
      )
        ? "aria"
        : undefined,
      criticalResultId: ["hit_location", "critical", "damage_roll", "damage_review"].includes(
        input.kind,
      )
        ? "attack-result-1:critical"
        : undefined,
      damageRollExpression: input.kind === "damage_roll" ? "1d7" : undefined,
      damageReviewId: ["hit_location", "critical", "damage_roll", "damage_review"].includes(
        input.kind,
      )
        ? "attack-result-1:damage-review"
        : undefined,
      defenderParticipantId: ["hit_location", "critical", "damage_roll", "damage_review"].includes(
        input.kind,
      )
        ? "borin"
        : undefined,
      executionGroupId: `group:${input.id ?? input.kind}`,
      hitLocationResultId: ["hit_location", "critical", "damage_roll", "damage_review"].includes(
        input.kind,
      )
        ? "attack-result-1:hit-location"
        : undefined,
      opportunityId: "opportunity-1",
      opponentParticipantId:
        input.kind === "parry" ? input.actor?.participantId : input.target?.participantId,
      pairId:
        input.kind.startsWith("adjust_distance") || input.kind.startsWith("break_off")
          ? "aria::borin"
          : undefined,
      phase: input.phase ?? "phase1",
      proposalId: input.kind.includes("feint")
        ? "proposal-feint"
        : input.kind.startsWith("adjust_distance")
          ? "proposal-distance"
          : input.kind.startsWith("break_off")
            ? "proposal-break-off"
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
      damageRollExpression: input.kind === "damage_roll" ? "1d7" : undefined,
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
    canonicalTask?: CombatProgressionPresentationTask;
    canonicalTaskVisibility?: "redacted" | "unavailable" | "visible";
    canonicalWaitingFor?: "combatant" | "gm" | "unknown";
    conflicted?: boolean;
    executionStrategy?:
      | "gm_review"
      | "initiative_groups"
      | "ordered_all"
      | "parallel_all"
      | "single_task";
    tasks?: readonly CombatProgressionPresentationTask[];
  } = {},
): CombatProgressionPresentationProjection {
  const tasks = input.tasks ?? [];
  const boundary = input.boundary ?? "phase1_resolution";
  return {
    awaitingGmTransition: input.awaitingGmTransition ?? false,
    boundary: { id: `boundary:${boundary}`, kind: boundary, roundNumber: 2 },
    canonicalOperationalPosition:
      input.canonicalTask || input.canonicalTaskVisibility
        ? {
            executionGroupId: input.canonicalTask?.executionGroupId,
            executionStrategy: input.executionStrategy ?? "single_task",
            processId: input.canonicalTask?.processId,
            roundNumber: 2,
            stageId: input.canonicalTask?.stageId,
            task:
              input.canonicalTaskVisibility === "redacted" ||
              input.canonicalTaskVisibility === "unavailable"
                ? undefined
                : input.canonicalTask,
            taskVisibility:
              input.canonicalTaskVisibility ?? (input.canonicalTask ? "visible" : "unavailable"),
            trackerFacet: input.canonicalTask?.trackerFacet ?? { step: "M2" },
            waitingFor: input.canonicalWaitingFor ?? "gm",
          }
        : undefined,
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
  it.each([
    ["disarm_actor_roll", aria],
    ["disarm_holder_roll", borin],
  ] as const)("keeps the exact attempt identity on the player %s command", (kind, owner) => {
    const rollTask = task({
      actionKind: "disarm",
      actor: aria,
      command: "roll_disarm",
      kind,
      owner,
      target: borin,
    });
    const projectedTask = {
      ...rollTask,
      identity: {
        ...rollTask.identity,
        disarmAttemptId: "disarm-attempt-1",
      },
    };
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-disarm",
      progression: progression({ tasks: [projectedTask] }),
      viewer: { controlledParticipantIds: new Set([owner.participantId]), kind: "player" },
    });

    expect(result?.primaryAction.descriptor).toMatchObject({
      commandType: "roll_disarm",
      disarmAttemptId: "disarm-attempt-1",
      participantId: owner.participantId,
    });
  });

  it("keeps the exact attempt identity on a player reactive Parry-Disarm command", () => {
    const parryTask = task({
      actionKind: "parry_disarm",
      actor: borin,
      command: "roll_parry",
      kind: "parry",
      owner: aria,
      target: aria,
    });
    const projectedTask = {
      ...parryTask,
      identity: {
        ...parryTask.identity,
        disarmAttemptId: "disarm-attempt-reactive",
        parryPurpose: "parry_disarm" as const,
        parrySourceId: "item-main-gauche",
      },
    };
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-disarm",
      progression: progression({ tasks: [projectedTask] }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result?.primaryAction.descriptor).toMatchObject({
      commandType: "roll_parry",
      disarmAttemptId: "disarm-attempt-reactive",
      parryPurpose: "parry_disarm",
      parrySourceId: "item-main-gauche",
      participantId: "aria",
    });
  });

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

  it.each(["miss", "hit"] as const)(
    "presents proactive Offensive Parry after an incoming %s without implying the attack hit",
    (attackOutcome) => {
      const base = task({
        actionKind: "offensive_parry",
        actor: borin,
        command: "roll_parry",
        kind: "parry",
        owner: aria,
        responder: aria,
        target: aria,
      });
      const candidate: CombatProgressionPresentationTask = {
        ...base,
        identity: {
          ...base.identity,
          attackerParticipantId: "borin",
          declarationId: "declaration-aria",
          declaredOpponentParticipantId: "borin",
          defenderParticipantId: "aria",
          offensiveParryAttemptId: "offensive-parry-attempt-1",
          parryPurpose: "offensive_parry",
          parrySourceId: "main-hand",
        },
        presentationContext: {
          ...base.presentationContext,
          attackOutcome,
        },
      };

      const result = build([candidate], "player");
      expect(result).toMatchObject({
        actionName: "Offensive Parry",
        primaryAction: {
          descriptor: {
            declarationId: "declaration-aria",
            declaredOpponentParticipantId: "borin",
            offensiveParryAttemptId: "offensive-parry-attempt-1",
            parryPurpose: "offensive_parry",
            parrySourceId: "main-hand",
          },
          label: "Roll Offensive Parry",
        },
        requiredNow: "Attempt the parry.",
        summary: `Borin committed to an attack. The attack ${attackOutcome === "hit" ? "hit" : "missed"}. Aria prepared an Offensive Parry.`,
      });
    },
  );

  it("binds Offensive Parry Brawling to the exact contest and parry lineage", () => {
    const base = task({
      actionKind: "offensive_parry",
      actor: aria,
      command: "roll_offensive_parry_brawling",
      kind: "offensive_parry_brawling_roll",
      owner: aria,
      responder: aria,
      target: borin,
    });
    const candidate: CombatProgressionPresentationTask = {
      ...base,
      identity: {
        ...base.identity,
        attackResultId: "attack-result-1",
        contestId: "contest-1",
        declarationId: "declaration-1",
        opponentParticipantId: "borin",
        parryResultId: "parry-result-1",
      },
    };

    const result = build([candidate]);

    expect(result).toMatchObject({
      actionName: "Offensive Parry",
      heading: "Phase 1",
      primaryAction: {
        descriptor: {
          attackResultId: "attack-result-1",
          commandType: "roll_offensive_parry_brawling",
          contestId: "contest-1",
          declarationId: "declaration-1",
          executionGroupId: "group:offensive_parry_brawling_roll",
          opponentParticipantId: "borin",
          opportunityId: "opportunity-1",
          parryResultId: "parry-result-1",
          processId: "process:offensive_parry_brawling_roll",
          stageId: "stage:offensive_parry_brawling_roll",
          taskId: "task:offensive_parry_brawling_roll",
        },
        enabled: true,
        label: "Roll Brawling",
      },
      requiredNow: "Roll Brawling.",
      summary: "Your Offensive Parry succeeded. Contest Borin's balance.",
    });
  });

  it("shows a recorded Brawling roll as waiting while the opponent task remains", () => {
    const base = task({
      actionKind: "offensive_parry",
      actor: aria,
      command: "roll_offensive_parry_brawling",
      kind: "offensive_parry_brawling_roll",
      owner: borin,
      responder: borin,
      target: borin,
    });
    const result = build([base], "player");

    expect(result).toMatchObject({
      primaryAction: {
        enabled: false,
        viewerMayInvoke: false,
      },
      requiredNow: "Waiting for Borin.",
      summary: "Your Brawling roll is recorded. Waiting for Borin.",
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
        label: "Waiting for Aria",
        viewerMayInvoke: false,
      },
      requiredNow: "Waiting for Aria.",
      summary: "Borin hit Aria.",
      taskKind: "parry",
    });
    expect(result?.primaryAction.descriptor).toBeUndefined();
  });

  it.each([
    ["hit_location", "roll_hit_location", "Roll hit location"],
    ["critical", "roll_critical", "Roll critical"],
    ["damage_roll", "resolve_damage", "Roll damage"],
    ["damage_review", "resolve_damage", "Resolve damage"],
    ["damage_review", "commit_phase_damage", "Commit damage"],
  ] as const)("binds %s to all downstream result identities", (kind, command, label) => {
    const gmOnly = kind === "damage_review";
    const result = build([
      task({
        actor: aria,
        command,
        gmOnly,
        kind,
        owner: gmOnly ? undefined : aria,
        target: borin,
      }),
    ]);
    expect(result).toMatchObject({
      primaryAction: {
        descriptor: {
          attackResultId: "attack-result-1",
          attackerParticipantId: "aria",
          criticalResultId: "attack-result-1:critical",
          damageRollExpression: kind === "damage_roll" ? "1d7" : undefined,
          damageReviewId: "attack-result-1:damage-review",
          defenderParticipantId: "borin",
          executionGroupId: `group:${kind}`,
          hitLocationResultId: "attack-result-1:hit-location",
          opportunityId: "opportunity-1",
          phase: "phase1",
          taskId: `task:${kind}`,
        },
        label,
      },
      summary: "Aria hit Borin.",
    });
  });

  it("fails closed when a downstream handler receives a mismatched descriptor", () => {
    const presentation = build([
      task({ actor: aria, command: "roll_critical", kind: "critical", target: borin }),
    ]);
    const descriptor = presentation?.primaryAction.descriptor;
    expect(
      resolveCombatTaskCommandContext({
        descriptor,
        expectedCommandTypes: ["roll_critical"],
        presentation,
        requiredFields: ["attackResultId", "criticalResultId", "executionGroupId"],
      }),
    ).toBe(descriptor);
    expect(
      resolveCombatTaskCommandContext({
        descriptor: descriptor ? { ...descriptor, taskId: "stale-task" } : undefined,
        expectedCommandTypes: ["roll_critical"],
        presentation,
        requiredFields: ["attackResultId", "criticalResultId", "executionGroupId"],
      }),
    ).toBeUndefined();
  });

  it("shows involved players safe context but no descriptor for GM damage review", () => {
    const damageTask = task({
      actor: aria,
      command: "commit_phase_damage",
      gmOnly: true,
      kind: "damage_review",
      owner: undefined,
      target: borin,
    });
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-20T12:00:00.000Z",
      progression: progression({ tasks: [damageTask] }),
      viewer: { controlledParticipantIds: new Set(["borin"]), kind: "player" },
    });

    expect(result).toMatchObject({
      primaryAction: { enabled: false, label: "Waiting for GM", viewerMayInvoke: false },
      requiredNow: "Waiting for GM.",
      summary: "Aria hit Borin.",
      taskKind: "damage_review",
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

  it.each([
    ["break_off_escapee_roll", aria, "aria"],
    ["break_off_attacker_roll", borin, "borin"],
  ] as const)(
    "lets the controlling player execute %s with exact task identity",
    (kind, owner, controlledId) => {
      const breakOffTask = task({
        actionKind: "break_off_engagement",
        actor: aria,
        command: "roll_break_off",
        kind,
        owner,
        responder: owner,
        target: borin,
      });
      const result = buildCurrentActionPresentation({
        encounterId: "encounter-1",
        encounterRevision: "2026-07-20T12:00:00.000Z",
        progression: progression({ tasks: [breakOffTask] }),
        viewer: { controlledParticipantIds: new Set([controlledId]), kind: "player" },
      });

      expect(result).toMatchObject({
        actionName: "Break Off",
        primaryAction: {
          enabled: true,
          label: "Roll Dodge",
          viewerMayInvoke: true,
        },
        requiredNow: "Roll Dodge.",
        status: "executable",
      });
      expect(result?.primaryAction.descriptor).toMatchObject({
        commandType: "roll_break_off",
        expectedRevision: "2026-07-20T12:00:00.000Z",
        pairId: "aria::borin",
        participantId: controlledId,
        proposalId: "proposal-break-off",
        taskId: `task:${kind}`,
      });
    },
  );

  it("shows a safe wait after the player's Break Off roll while the opponent owns the remaining roll", () => {
    const remainingOpponentTask = task({
      actionKind: "break_off_engagement",
      actor: aria,
      command: "roll_break_off",
      kind: "break_off_attacker_roll",
      owner: borin,
      responder: borin,
      target: borin,
    });
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "2026-07-20T12:00:00.000Z",
      progression: progression({ tasks: [remainingOpponentTask] }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      primaryAction: { enabled: false, viewerMayInvoke: false },
      requiredNow: "Waiting for Borin.",
      status: "waiting",
      summary: "Your Dodge roll is recorded. Waiting for Borin.",
    });
    expect(result?.primaryAction.descriptor).toBeUndefined();
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

  it("presents the observer-owned SU contest as the single current action", () => {
    const observationTask = {
      ...task({
        actionKind: "observe_opponent_contest",
        actor: aria,
        command: "roll_observation",
        kind: "observation_roll",
        owner: aria,
        target: borin,
      }),
      identity: {
        executionGroupId: "group:observation",
        observationAttemptId: "observation:aria:borin:attempt:1",
        opponentParticipantId: "borin",
        participantId: "aria",
        relationshipId: "observation:aria:borin",
      },
      trackerFacet: { owner: aria, step: "SU" as const },
    };
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-observation",
      progression: progression({ boundary: "round_end", tasks: [observationTask] }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      actionName: "Observe Opponent",
      primaryAction: {
        label: "Roll observation",
        viewerMayInvoke: true,
      },
      requiredNow: "Roll your observation contest.",
      summary: "You have completed an observation interval against Borin.",
    });
    expect(result?.primaryAction.descriptor).toMatchObject({
      commandType: "roll_observation",
      observationAttemptId: "observation:aria:borin:attempt:1",
      relationshipId: "observation:aria:borin",
    });
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
    expect(result?.primaryAction.descriptor).toBeUndefined();
  });

  it("holds a player at the privacy-safe SU round-end checkpoint", () => {
    const base = progression({ boundary: "round_boundary", tasks: [] });
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-2",
      progression: {
        ...base,
        canonicalOperationalPosition: {
          executionStrategy: "gm_review",
          roundNumber: 1,
          taskVisibility: "redacted",
          trackerFacet: { step: "SU" },
          waitingFor: "gm",
        },
      },
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      heading: "Round boundary",
      primaryAction: { enabled: false, label: "Waiting for GM" },
      requiredNow: "Waiting for GM to complete round-end review.",
      status: "awaiting_gm",
      summary: "Round-end work is complete. The GM must open the next round.",
      trackerFacet: "SU",
    });
    expect(result?.primaryAction.descriptor).toBeUndefined();
  });

  it("selects an executable GM prerequisite before the player's blocked Combat Experience roll", () => {
    const gmDifficulty = task({
      command: "set_combat_experience_difficulty",
      gmOnly: true,
      id: "ce-difficulty",
      kind: "combat_experience",
    });
    const playerRoll = task({
      actor: aria,
      command: "roll_combat_experience",
      id: "ce-roll-aria",
      kind: "combat_experience",
      owner: aria,
      state: "waiting",
    });
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-2",
      progression: progression({ boundary: "declaration", tasks: [gmDifficulty, playerRoll] }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      primaryAction: { enabled: false, label: "Waiting for GM" },
      requiredActor: { label: "GM" },
      requiredNow: "Waiting for GM.",
      status: "awaiting_gm",
    });
    expect(result?.primaryAction.descriptor).toBeUndefined();
  });

  it("names the participant who owns the current task", () => {
    const result = build(
      [task({ actor: borin, kind: "attack", owner: borin, target: aria })],
      "player",
    );

    expect(result?.status).toBe("waiting");
    expect(result?.requiredNow).toBe("Waiting for Borin.");
    expect(result?.primaryAction).toMatchObject({
      enabled: false,
      label: "Waiting for Borin",
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

  it("does not select a later viewer task while a redacted canonical M2 review is unresolved", () => {
    const laterPlayerTask = task({
      id: "later-player-task",
      kind: "attack",
      owner: aria,
      target: borin,
    });
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-1",
      progression: progression({
        boundary: "phase2_modifier_review",
        canonicalTaskVisibility: "redacted",
        canonicalWaitingFor: "gm",
        tasks: [laterPlayerTask],
      }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      boundary: "phase2_modifier_review",
      primaryAction: { enabled: false, label: "Waiting for GM" },
      requiredNow: "Waiting for GM modifier review.",
      status: "awaiting_gm",
      trackerFacet: "M2",
    });
    expect(result?.primaryAction.descriptor).toBeUndefined();
    expect(result?.taskId).toBeUndefined();
  });

  it("fails closed on an incomplete legacy operational position instead of falling forward", () => {
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-legacy",
      progression: progression({
        boundary: "declaration",
        canonicalTaskVisibility: "unavailable",
        tasks: [task({ id: "later", kind: "attack", owner: aria })],
      }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      primaryAction: { enabled: false, label: "Action unavailable" },
      requiredNow: "Waiting for the GM to repair the active combat state.",
      status: "awaiting_gm",
      taskHeading: "Combat state incomplete",
    });
    expect(result?.taskId).toBeUndefined();
  });

  it("keeps same-stage parallel authority separate from the canonical board task", () => {
    const canonicalTask = task({ id: "borin-task", kind: "attack", owner: borin, target: aria });
    const playerTask = {
      ...task({ id: "aria-task", kind: "attack", owner: aria, target: borin }),
      executionGroupId: canonicalTask.executionGroupId,
    };
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-1",
      progression: progression({
        canonicalTask,
        executionStrategy: "parallel_all",
        tasks: [canonicalTask, playerTask],
      }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      primaryAction: { enabled: true, viewerMayInvoke: true },
      taskId: "aria-task",
    });
  });

  it("keeps a viewer-owned same-stage task actionable when the canonical task identity is private", () => {
    const hiddenCanonicalTask = task({
      id: "hidden-initiative",
      kind: "roll_initiative",
      owner: borin,
    });
    const ownInitiative = {
      ...task({ id: "own-initiative", kind: "roll_initiative", owner: aria }),
      stageId: hiddenCanonicalTask.stageId,
    };
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-1",
      progression: progression({
        boundary: "phase1_initiative",
        canonicalTask: hiddenCanonicalTask,
        canonicalTaskVisibility: "redacted",
        executionStrategy: "initiative_groups",
        tasks: [ownInitiative],
      }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      boundary: "phase1_initiative",
      primaryAction: { enabled: true, viewerMayInvoke: true },
      taskId: "own-initiative",
    });
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

  it("explains lower-group and completed-tie waiting without an unavailable error", () => {
    const base = progression();
    const lowerWaiting = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-initiative",
      progression: {
        ...base,
        executionOrder: {
          currentInitiativeGroupId: "group-4",
          currentInitiativeValue: 4,
          initiativeGroups: [
            {
              id: "group-4",
              initiativeValue: 4,
              opportunityIds: [],
              participantIds: ["borin"],
              status: "current",
            },
            {
              id: "group-3",
              initiativeValue: 3,
              opportunityIds: [],
              participantIds: ["aria"],
              status: "waiting",
            },
          ],
          participantIds: ["borin", "aria"],
          phase: "phase1",
        },
      },
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });
    expect(lowerWaiting).toMatchObject({
      primaryAction: { enabled: false, label: "Waiting" },
      requiredNow: "Waiting for Initiative 4 to finish.",
      summary:
        "Initiative 4 is still being resolved. Your Initiative 3 action will open after Initiative 4 completes.",
    });

    const tiedWaiting = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-initiative",
      progression: {
        ...base,
        executionOrder: {
          currentInitiativeGroupId: "group-4",
          currentInitiativeValue: 4,
          initiativeGroups: [
            {
              id: "group-4",
              initiativeValue: 4,
              opportunityIds: [],
              participantIds: ["aria", "borin"],
              status: "current",
            },
          ],
          participantIds: ["aria", "borin"],
          phase: "phase1",
        },
      },
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });
    expect(tiedWaiting?.summary).toBe(
      "Your Initiative 4 action is recorded. Other Initiative 4 actions are still being resolved.",
    );
  });

  it("presents Continued Contact distance ownership to the controller and waiting opponent", () => {
    const distanceTask = task({
      actionKind: "continued_contact_distance_control",
      actor: aria,
      command: "commit_round_end_distance_control",
      currentDistance: 4,
      kind: "distance_commit",
      owner: aria,
      reason: "Continued Contact is active.",
      target: borin,
    });
    const projected = progression({ boundary: "round_end", tasks: [distanceTask] });
    const controller = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-distance",
      progression: projected,
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });
    const opponent = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-distance",
      progression: projected,
      viewer: { controlledParticipantIds: new Set(["borin"]), kind: "player" },
    });

    expect(controller).toMatchObject({
      actionName: "Continued Contact",
      primaryAction: {
        enabled: true,
        label: "Choose engagement distance",
        viewerMayInvoke: true,
      },
      reason: "Continued Contact is active.",
      requiredNow: "Choose engagement distance.",
      summary:
        "Aria is choosing engagement distance with Borin because Continued Contact is active.",
    });
    expect(opponent).toMatchObject({
      primaryAction: {
        enabled: false,
        label: "Waiting for Aria",
        viewerMayInvoke: false,
      },
      summary:
        "Aria is choosing engagement distance with Borin because Continued Contact is active.",
    });
  });

  it("presents participant-owned Continued Contact maintenance and escape rolls", () => {
    const controllerTask = {
      ...task({
        actionKind: "continued_contact_maintenance_controller",
        actor: aria,
        command: "roll_continued_contact_maintenance",
        kind: "continued_contact_maintenance_roll",
        owner: aria,
        reason: "Continued Contact is active.",
        responder: aria,
        target: borin,
      }),
      identity: {
        contestId: "maintenance-1",
        continuedContactId: "contact-1",
        executionGroupId: "group:continued-contact",
        opponentParticipantId: "borin",
        participantId: "aria",
        rollPurpose: "escape_continued_contact" as const,
      },
      trackerFacet: { owner: aria, step: "SU" as const },
    };
    const projected = progression({ boundary: "round_end", tasks: [controllerTask] });
    const controller = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-maintenance",
      progression: projected,
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });
    const defender = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-maintenance",
      progression: projected,
      viewer: { controlledParticipantIds: new Set(["borin"]), kind: "player" },
    });

    expect(controller).toMatchObject({
      actionName: "Continued Contact",
      primaryAction: {
        descriptor: {
          contestId: "maintenance-1",
          continuedContactId: "contact-1",
          rollPurpose: "escape_continued_contact",
        },
        enabled: true,
        label: "Roll Brawling",
      },
      requiredNow: "Maintain Continued Contact. Roll Brawling.",
      summary: "Maintain Continued Contact with Borin.",
      trackerFacet: "SU",
    });
    expect(defender).toMatchObject({
      primaryAction: { enabled: false },
      status: "waiting",
    });

    const affectedTask = {
      ...controllerTask,
      id: "task:maintenance:borin",
      identity: {
        ...controllerTask.identity,
        opponentParticipantId: "aria",
        participantId: "borin",
      },
      owner: borin,
      presentationContext: {
        ...controllerTask.presentationContext,
        actionKind: "continued_contact_maintenance_escape",
        responder: borin,
      },
      trackerFacet: { owner: borin, step: "SU" as const },
    };
    const affectedAction = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-maintenance",
      progression: progression({ boundary: "round_end", tasks: [affectedTask] }),
      viewer: { controlledParticipantIds: new Set(["borin"]), kind: "player" },
    });
    expect(affectedAction).toMatchObject({
      primaryAction: { enabled: true, label: "Roll Brawling" },
      requiredNow: "Attempt to escape Continued Contact. Roll Brawling.",
      summary: "Attempt to escape Aria's Continued Contact.",
    });

    const afterDefenderRolled = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-maintenance-2",
      progression: progression({
        boundary: "round_end",
        tasks: [
          {
            ...controllerTask,
            presentationContext: {
              ...controllerTask.presentationContext,
              opponentRollRecorded: true,
            },
          },
        ],
      }),
      viewer: { controlledParticipantIds: new Set(["borin"]), kind: "player" },
    });
    expect(afterDefenderRolled).toMatchObject({
      primaryAction: {
        enabled: false,
        label: "Waiting for Aria",
      },
      requiredNow: "Waiting for Aria.",
      summary: "Your Brawling roll is recorded. Waiting for Aria.",
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

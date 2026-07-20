import type {
  CombatProgressionBoundaryKind,
  CombatProgressionExpectedCommand,
  CombatProgressionPresentationProjection,
  CombatProgressionPresentationTask,
  CombatProgressionTaskKind,
} from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { buildCurrentActionPresentation } from "./currentActionPresentation";

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
      opponentParticipantId: input.target?.participantId,
      phase: input.phase ?? "phase1",
      proposalId: input.kind.includes("feint") ? "proposal-feint" : undefined,
    },
    kind: input.kind,
    opponent: input.target,
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

function progression(input: {
  awaitingGmTransition?: boolean;
  boundary?: CombatProgressionBoundaryKind;
  conflicted?: boolean;
  tasks?: readonly CombatProgressionPresentationTask[];
} = {}): CombatProgressionPresentationProjection {
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
      heading: "Single Attack · Aria → Borin · Phase 1",
      primaryAction: {
        descriptor: {
          commandType: "roll_attack",
          expectedRevision: "2026-07-20T12:00:00.000Z",
          opportunityId: "opportunity-1",
          taskId: "task:attack",
        },
        label: "Roll Phase 1 attack",
      },
      target: { id: "borin", label: "Borin" },
      taskHeading: "Single Attack — attack roll",
      weapon: { label: "Long Sword" },
    });
    expect(result?.summary).toBe("Aria is attacking Borin with Long Sword.");
    expect(result?.reason).toBe("This attack follows the declared Single Attack.");
    expect(result?.expectedNextProcess?.label).toContain("defender may parry");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.primaryAction.descriptor)).toBe(true);
  });

  it("presents parry with the attacker, defender, required responder, reason, and next work", () => {
    const result = build([
      task({
        actor: borin,
        command: "roll_parry",
        kind: "parry",
        owner: aria,
        responder: aria,
        target: aria,
      }),
    ], "player");

    expect(result?.heading).toBe("Parry · Borin → Aria · Phase 1");
    expect(result?.requiredActor.label).toBe("Aria");
    expect(result?.primaryAction.label).toBe("Roll parry");
    expect(result?.reason).toContain("defensive response");
    expect(result?.expectedNextProcess?.label).toContain("post-hit work");
  });

  it.each([
    ["feint_attacker_roll", "Roll Feint", "attacker roll"],
    ["feint_defender_roll", "Roll Feint resistance", "defender roll"],
    ["feint_commit", "Commit Feint result", "GM proposal commit"],
  ] as const)("presents %s from the canonical Feint task", (kind, button, inputLabel) => {
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
    expect(result?.taskHeading).toContain(inputLabel);
    expect(result?.primaryAction.label).toBe(button);
    expect(result?.primaryAction.descriptor?.proposalId).toBe("proposal-feint");
  });

  it.each([
    ["adjust_distance_response", "Confirm defender response"],
    ["adjust_distance_adjustment", "Confirm maneuver adjustment"],
    ["adjust_distance_attacker_roll", "Roll attacker Dodge"],
    ["adjust_distance_defender_roll", "Roll defender Dodge"],
    ["adjust_distance_commit", "Commit distance adjustment"],
  ] as const)("presents %s with canonical distance context", (kind, button) => {
    const gmOnly = kind === "adjust_distance_adjustment" || kind === "adjust_distance_commit";
    const result = build([
      task({
        actionKind: "adjust_distance_attack",
        actor: aria,
        command: "roll_adjust_distance",
        currentDistance: 3,
        gmOnly,
        kind,
        responder: kind.includes("defender") || kind.endsWith("response") ? borin : aria,
        requestedDistance: 2,
        target: borin,
      }),
    ]);

    expect(result?.summary).toBe(
      "Aria is attempting to move from distance 3 to distance 2 against Borin.",
    );
    expect(result?.primaryAction.label).toBe(button);
    expect(result?.expectedNextProcess?.label).toBeTruthy();
  });

  it("presents the Double Attack decision and its two outcomes", () => {
    const result = build([
      task({
        actionKind: "double_attack",
        actor: aria,
        command: "decide_double_attack_phase2",
        kind: "double_attack_decision",
        target: borin,
      }),
    ]);

    expect(result?.taskHeading).toBe("Double Attack — Continue or Cancel decision");
    expect(result?.reason).toContain("first attack is complete");
    expect(result?.expectedNextProcess?.label).toContain("Continue opens Attack 2");
  });

  it.each([
    ["combat_experience", "Roll Combat Experience", "Combat Experience"],
    ["health_review", "Roll Health check", "Health Review"],
    ["distance_roll", "Roll distance control", "Distance Control"],
    ["effect_review", "Commit participant SU review", "Effect Review"],
    ["round_end_prepare", "Prepare round-end review", "Round End"],
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
    if (kind === "health_review") expect(result?.reason).toBe("Bleeding requires review.");
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
    expect(result?.summary).toBe("Aria must resolve Combat Experience at difficulty 26.");
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

    expect(result?.primaryAction.label).toBe("Open Phase 2 modifier review");
    expect(result?.primaryAction.descriptor?.targetBoundary).toBe("phase2_modifier_review");
    expect(result?.requiredActor.label).toBe("GM");
    expect(result?.reason).toContain("does not open the next combat boundary automatically");
  });

  it("shows player-safe Waiting for GM without exposing the hidden GM task descriptor", () => {
    const result = buildCurrentActionPresentation({
      encounterId: "encounter-1",
      encounterRevision: "revision-2",
      progression: progression({ awaitingGmTransition: true, tasks: [] }),
      viewer: { controlledParticipantIds: new Set(["aria"]), kind: "player" },
    });

    expect(result).toMatchObject({
      primaryAction: { enabled: false, label: "Waiting for GM" },
      requiredActor: { label: "GM" },
      status: "awaiting_gm",
    });
    expect(result?.primaryAction).not.toHaveProperty("descriptor");
  });

  it("shows Waiting for another combatant when the visible task belongs to someone else", () => {
    const result = build([
      task({ actor: borin, kind: "attack", owner: borin, target: aria }),
    ], "player");

    expect(result?.status).toBe("waiting");
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
      status: "conflicted",
    });
  });
});

import type { CombatProgressionPresentationTask, CombatProgressionTaskKind } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  buildCombatTrackerTaskHover,
  classifyCombatTrackerTaskAttention,
} from "./combatTrackerTaskPresentation";

const ORDINARY_TASK_KINDS = [
  "attack",
  "commit_initiative",
  "effect_review",
  "gm_advance_boundary",
  "modifier_review",
  "participant_review",
  "roll_initiative",
  "round_end_prepare",
  "submit_declaration",
] satisfies CombatProgressionTaskKind[];

const EXCEPTIONAL_TASK_KINDS = [
  "adjust_distance_adjustment",
  "adjust_distance_attacker_roll",
  "adjust_distance_commit",
  "adjust_distance_defender_roll",
  "adjust_distance_response",
  "combat_experience",
  "continued_contact_maintenance_roll",
  "critical",
  "damage_roll",
  "damage_review",
  "distance_commit",
  "distance_roll",
  "double_attack_decision",
  "feint_attacker_roll",
  "feint_commit",
  "feint_defender_roll",
  "health_review",
  "hit_location",
  "offensive_parry_brawling_roll",
  "parry",
] satisfies CombatProgressionTaskKind[];

const GM_ONLY_TASK_KINDS = new Set<CombatProgressionTaskKind>([
  "adjust_distance_adjustment",
  "adjust_distance_commit",
  "commit_initiative",
  "damage_review",
  "distance_commit",
  "effect_review",
  "feint_commit",
  "gm_advance_boundary",
  "modifier_review",
  "participant_review",
  "round_end_prepare",
]);

function task(
  kind: CombatProgressionTaskKind,
  overrides: Partial<CombatProgressionPresentationTask> = {},
): CombatProgressionPresentationTask {
  return {
    actorAccess: { combatant: true, gm: true },
    automation: {
      authority: { kind: "unknown" },
      eligibility: "unsupported",
      schemaVersion: 1,
      taskId: `task:${kind}`,
      warnings: [],
      workClass: "not_applicable",
    },
    contributesToProgression: true,
    executionGroupId: "group-1",
    expectedCommand: "roll_attack",
    id: `task:${kind}`,
    identity: { executionGroupId: "group-1", phase: "phase1" },
    kind,
    owner: { kind: "combatant", label: "The Gladiator", participantId: "gladiator" },
    processId: "process-1",
    stageId: "stage-1",
    state: "executable",
    trackerFacet: {
      owner: { kind: "combatant", label: "The Gladiator", participantId: "gladiator" },
      step: "A1",
    },
    ...overrides,
  };
}

describe("combat tracker task presentation", () => {
  it.each(ORDINARY_TASK_KINDS)("classifies %s as ordinary", (kind) => {
    expect(classifyCombatTrackerTaskAttention(task(kind))).toBe("ordinary");
  });

  it.each(EXCEPTIONAL_TASK_KINDS)("classifies %s as exceptional", (kind) => {
    expect(classifyCombatTrackerTaskAttention(task(kind))).toBe("exceptional");
  });

  it.each([...ORDINARY_TASK_KINDS, ...EXCEPTIONAL_TASK_KINDS])(
    "builds safe task-derived hover context for %s",
    (kind) => {
      const hover = buildCombatTrackerTaskHover(
        task(kind, {
          actorAccess: GM_ONLY_TASK_KINDS.has(kind)
            ? { combatant: false, gm: true }
            : { combatant: true, gm: true },
          opponent: {
            kind: "combatant",
            label: "Scyrian cavalry guy",
            participantId: "scyrian",
          },
        }),
      );

      expect(hover.actionLabel.length).toBeGreaterThan(0);
      expect(hover.text.length).toBeGreaterThan(0);
      expect(JSON.stringify(hover)).not.toContain("rollD20");
      expect(JSON.stringify(hover)).not.toContain("blocker");
    },
  );

  it("builds task-derived declaration and Combat Experience hover text", () => {
    expect(buildCombatTrackerTaskHover(task("submit_declaration"))).toMatchObject({
      actionLabel: "Declaration",
      requiredActorLabel: "The Gladiator",
      text: "Declaration open for The Gladiator.",
    });
    expect(buildCombatTrackerTaskHover(task("combat_experience"))).toMatchObject({
      actionLabel: "Combat Experience",
      text: "Combat Experience roll required for The Gladiator.",
    });
  });

  it("marks Continued Contact maintenance as SU Brawling work for the exact owner", () => {
    expect(
      buildCombatTrackerTaskHover(
        task("continued_contact_maintenance_roll", {
          expectedCommand: "roll_continued_contact_maintenance",
          identity: {
            contestId: "maintenance-1",
            continuedContactId: "contact-1",
            executionGroupId: "group-1",
            opponentParticipantId: "scyrian",
            rollPurpose: "escape_continued_contact",
          },
          opponent: {
            kind: "combatant",
            label: "Scyrian cavalry guy",
            participantId: "scyrian",
          },
          trackerFacet: {
            owner: { kind: "combatant", label: "The Gladiator", participantId: "gladiator" },
            step: "SU",
          },
        }),
      ),
    ).toMatchObject({
      actionLabel: "Continued Contact",
      requiredActorLabel: "The Gladiator",
      text: "The Gladiator must roll Brawling against Scyrian cavalry guy for Continued Contact.",
    });
  });

  it("names the required defender and visible attacker without private facts", () => {
    const hover = buildCombatTrackerTaskHover(
      task("parry", {
        opponent: {
          kind: "combatant",
          label: "Scyrian cavalry guy",
          participantId: "scyrian",
        },
        owner: { kind: "combatant", label: "The Gladiator", participantId: "gladiator" },
      }),
    );

    expect(hover).toMatchObject({
      actorLabel: "Scyrian cavalry guy",
      requiredActorLabel: "The Gladiator",
      targetLabel: "The Gladiator",
      text: "The Gladiator must respond to Scyrian cavalry guy’s attack.",
    });
    expect(JSON.stringify(hover)).not.toContain("rollD20");
    expect(JSON.stringify(hover)).not.toContain("diagnostic");
  });

  it("uses a safe fallback when the opposing identity is hidden", () => {
    expect(buildCombatTrackerTaskHover(task("parry", { opponent: undefined })).text).toBe(
      "The Gladiator must respond to another combatant’s attack.",
    );
  });

  it("formats an explicit GM boundary transition without participant question-mark context", () => {
    expect(
      buildCombatTrackerTaskHover(
        task("gm_advance_boundary", {
          actorAccess: { combatant: false, gm: true },
          owner: { id: "gm", kind: "gm", label: "Game Master" },
          transition: {
            currentBoundary: "phase1_modifier_review",
            requiredCompletedProcessIds: ["modifiers"],
            targetBoundary: "phase1_initiative",
          },
        }),
      ),
    ).toMatchObject({
      gmActionRequired: true,
      text: "Awaiting GM: Open Phase 1 initiative.",
    });
  });

  it("treats a participant-associated GM-only review as GM work", () => {
    expect(
      buildCombatTrackerTaskHover(
        task("modifier_review", {
          actorAccess: { combatant: false, gm: true },
        }),
      ),
    ).toMatchObject({
      gmActionRequired: true,
      requiredActorLabel: "Game Master",
      text: "Awaiting GM: Review Phase 1 modifiers for The Gladiator.",
    });
  });

  it("names a defense review without the retired awareness wording (#874)", () => {
    const hover = buildCombatTrackerTaskHover(
      task("defense_review", {
        actorAccess: { combatant: false, gm: true },
        expectedCommand: "commit_defense_review",
      }),
    );

    expect(hover.text).toBe("Awaiting GM: Review defense sources for The Gladiator.");
    expect(hover.text).not.toMatch(/awareness/i);
  });

  it("uses Start next round wording for the round-boundary transition", () => {
    expect(
      buildCombatTrackerTaskHover(
        task("gm_advance_boundary", {
          actorAccess: { combatant: false, gm: true },
          owner: { id: "gm", kind: "gm", label: "Game Master" },
          transition: {
            currentBoundary: "round_boundary",
            requiredCompletedProcessIds: ["round-end"],
            targetBoundary: "declaration",
          },
        }),
      ).text,
    ).toBe("Awaiting GM: Start next round.");
  });
});

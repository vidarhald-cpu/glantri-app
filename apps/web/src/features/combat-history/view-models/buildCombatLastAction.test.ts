import type { CombatLogEventPresentation } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  buildCombatLastAction,
  type BuildCombatLastActionInput,
  type CombatLastActionCommand,
  type CombatLastActionEvent,
} from "./buildCombatLastAction";

const participants = [
  { label: "GangHo", participantId: "p-gangho" },
  { label: "Halgeir", participantId: "p-halgeir" },
  { label: "Bramwell", participantId: "p-bramwell" },
];

function logEvent(
  id: string,
  sourceEventId: string,
  overrides: Partial<CombatLogEventPresentation>,
): CombatLogEventPresentation {
  return {
    category: "declaration",
    encounterId: "e1",
    id,
    roundNumber: 1,
    sequence: 0,
    sourceEventIds: [sourceEventId],
    sourceRevision: "r1",
    state: "final",
    summary: "",
    summaryFacts: { kind: "round_opened", roundNumber: 1 },
    ...overrides,
  };
}

function command(
  id: string,
  type: string,
  participantId: string,
  overrides: Partial<CombatLastActionCommand> = {},
): CombatLastActionCommand {
  return { id, participantId, roundNumber: 1, type, ...overrides };
}

function event(
  id: string,
  commandId: string,
  sequence: number,
  overrides: Partial<CombatLastActionEvent> = {},
): CombatLastActionEvent {
  return { commandId, facts: {}, id, roundNumber: 1, sequence, type: "declaration", ...overrides };
}

const subjects = {
  bramwell: { displayName: "Bramwell", participantId: "p-bramwell" },
  gangho: { displayName: "GangHo", participantId: "p-gangho" },
  halgeir: { displayName: "Halgeir", participantId: "p-halgeir" },
};

const declareGangHo = command("c-decl-g", "declare_action", "p-gangho");
const declareHalgeir = command("c-decl-h", "declare_action", "p-halgeir");
const rollBramwell = command("c-init-b", "roll_initiative_phase1", "p-bramwell", {
  phase: "phase1",
});
const rollAttack = command("c-atk", "roll_attack", "p-halgeir", { phase: "phase1" });
const rollParry = command("c-parry", "roll_parry", "p-gangho", { phase: "phase1" });
const commitDamage = command("c-dmg", "commit_phase_damage", "p-gangho", { phase: "phase1" });
const reviewPhase2 = command("c-rev2", "review_modifiers_phase2", "p-halgeir", { phase: "phase2" });

const events = [
  event("ev-decl-g", "c-decl-g", 0),
  event("ev-decl-h", "c-decl-h", 1),
  event("ev-init-b", "c-init-b", 2, {
    facts: { publicOutcome: { total: 8 } },
    ownerParticipantId: "p-bramwell",
    type: "initiative",
  }),
  event("ev-atk", "c-atk", 3, { type: "attack" }),
  event("ev-parry", "c-parry", 4, { type: "parry" }),
  event("ev-hit-location", "c-dmg", 5, { type: "hit_location" }),
  event("ev-dmg", "c-dmg", 6, { type: "damage_committed" }),
  event("ev-rev2", "c-rev2", 7, { type: "modifier_review" }),
];

const log = {
  attack: logEvent("l-atk", "ev-atk", {
    actor: subjects.halgeir,
    category: "attack",
    phase: "phase1",
    summaryFacts: { kind: "attack_resolved", outcome: "hit" },
    target: subjects.gangho,
  }),
  damage: logEvent("l-dmg", "ev-dmg", {
    actor: subjects.halgeir,
    category: "damage",
    phase: "phase1",
    summaryFacts: { amount: 25, kind: "damage_committed", source: "attack" },
    target: subjects.gangho,
  }),
  declareGangHo: logEvent("l-decl-g", "ev-decl-g", {
    actor: subjects.gangho,
    phase: "declaration",
    summaryFacts: { actionLabel: "Parry", kind: "declaration_submitted" },
  }),
  declareHalgeir: logEvent("l-decl-h", "ev-decl-h", {
    actor: subjects.halgeir,
    phase: "declaration",
    summaryFacts: { actionLabel: "Single Attack", kind: "declaration_submitted" },
  }),
  parry: logEvent("l-parry", "ev-parry", {
    actor: subjects.gangho,
    category: "defense",
    phase: "phase1",
    summaryFacts: { defense: "parry", kind: "defense_resolved", outcome: "failed" },
    target: subjects.halgeir,
  }),
};

function build(overrides: Partial<BuildCombatLastActionInput>) {
  return buildCombatLastAction({
    commands: [],
    events,
    logEvents: Object.values(log),
    participants,
    roundNumber: 1,
    ...overrides,
  })?.text;
}

describe("buildCombatLastAction", () => {
  it("names the declaring actor of the newest declaration in the journal", () => {
    expect(build({ commands: [declareGangHo] })).toBe("GangHo declared Parry");
    expect(build({ commands: [declareGangHo, declareHalgeir] })).toBe(
      "Halgeir declared Single Attack",
    );
  });

  it("names the attacker, the target and the outcome for a hit and a miss", () => {
    const commands = [declareGangHo, rollAttack];
    expect(build({ commands })).toBe("Halgeir attacked GangHo — hit");
    const miss = {
      ...log.attack,
      summaryFacts: { kind: "attack_resolved", outcome: "missed" },
    } as CombatLogEventPresentation;
    expect(build({ commands, logEvents: [log.declareGangHo, miss] })).toBe(
      "Halgeir attacked GangHo — miss",
    );
  });

  it("follows the journal through initiative, attack, parry and damage", () => {
    const journal = [
      declareGangHo,
      declareHalgeir,
      rollBramwell,
      rollAttack,
      rollParry,
      commitDamage,
    ];
    const expected = [
      "GangHo declared Parry",
      "Halgeir declared Single Attack",
      "Bramwell rolled Initiative 8",
      "Halgeir attacked GangHo — hit",
      "GangHo parried Halgeir — failed",
      "Halgeir dealt 25 damage to GangHo",
    ];
    journal.forEach((_, index) => {
      expect(build({ commands: journal.slice(0, index + 1) })).toBe(expected[index]);
    });
  });

  it("is not moved by Combat Log order: re-projected declarations after damage change nothing (#836 QA 24157)", () => {
    const commands = [
      declareGangHo,
      declareHalgeir,
      rollBramwell,
      rollAttack,
      rollParry,
      commitDamage,
      reviewPhase2,
    ];
    // The Phase 2 modifier review re-projects the declarations at the end of the log.
    const reordered = [log.attack, log.parry, log.damage, log.declareGangHo, log.declareHalgeir];
    expect(build({ commands, logEvents: reordered })).toBe("Halgeir dealt 25 damage to GangHo");
    expect(build({ commands, logEvents: [...reordered].reverse() })).toBe(
      "Halgeir dealt 25 damage to GangHo",
    );
  });

  it("a command with no nameable action leaves the previous action on the line", () => {
    expect(build({ commands: [declareGangHo, rollAttack, reviewPhase2] })).toBe(
      "Halgeir attacked GangHo — hit",
    );
  });

  it("a take-back that removes the newest command restores the previous action", () => {
    expect(build({ commands: [declareGangHo, rollAttack, rollParry] })).toBe(
      "GangHo parried Halgeir — failed",
    );
    expect(
      build({
        commands: [declareGangHo, rollAttack],
        events: events.filter((entry) => entry.commandId !== "c-parry"),
      }),
    ).toBe("Halgeir attacked GangHo — hit");
  });

  it("a re-declaration (a new declare command) becomes the line", () => {
    const again = command("c-decl-h2", "declare_action", "p-halgeir");
    expect(
      build({
        commands: [declareHalgeir, declareGangHo, again],
        events: [...events, event("ev-decl-h2", "c-decl-h2", 0)],
        logEvents: [
          log.declareGangHo,
          { ...log.declareHalgeir, sourceEventIds: ["ev-decl-h2"] } as CombatLogEventPresentation,
        ],
      }),
    ).toBe("Halgeir declared Single Attack");
  });

  it("is scoped to the current round", () => {
    expect(
      build({
        commands: [{ ...rollAttack, roundNumber: 1 }],
        roundNumber: 2,
      }),
    ).toBeUndefined();
  });

  it("never attributes an event to anyone but its actor and skips actorless events", () => {
    const actorless = logEvent("l-none", "ev-decl-g", {
      summaryFacts: { actionLabel: "Parry", kind: "declaration_submitted" },
    });
    expect(build({ commands: [declareGangHo], logEvents: [actorless] })).toBeUndefined();
  });

  it("a bulk initiative commit produces no line: the previous real action stays", () => {
    const bulk1 = command("c-commit-1", "commit_phase_initiative_resolution", "p-halgeir", {
      phase: "phase1",
    });
    const bulk2 = command("c-commit-2", "commit_phase_initiative_resolution", "p-halgeir", {
      phase: "phase2",
    });
    expect(build({ commands: [bulk1] })).toBeUndefined();
    expect(build({ commands: [declareGangHo, bulk1] })).toBe("GangHo declared Parry");
    expect(build({ commands: [declareGangHo, bulk1, rollAttack, commitDamage] })).toBe(
      "Halgeir dealt 25 damage to GangHo",
    );
    expect(build({ commands: [declareGangHo, bulk1, rollAttack, commitDamage, bulk2] })).toBe(
      "Halgeir dealt 25 damage to GangHo",
    );
  });

  it("a commit that closes individually rolled initiative is not a line of its own", () => {
    const bulk1 = command("c-commit-1", "commit_phase_initiative_resolution", "p-halgeir", {
      phase: "phase1",
    });
    expect(build({ commands: [declareGangHo, rollBramwell, bulk1] })).toBe(
      "Bramwell rolled Initiative 8",
    );
  });
});

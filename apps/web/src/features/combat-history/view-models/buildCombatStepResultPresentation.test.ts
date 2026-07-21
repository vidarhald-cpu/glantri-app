import { describe, expect, it } from "vitest";
import type {
  CombatLogEventPresentation,
  CombatLogProjection,
  ProjectedCombatHistoryEvent,
} from "@glantri/domain";

import { buildCombatStepResultPresentation } from "./buildCombatStepResultPresentation";

const revision = "2026-07-21T12:00:00.000Z";

function historyEvent(
  type: ProjectedCombatHistoryEvent["type"],
  sequence: number,
  overrides: Partial<ProjectedCombatHistoryEvent> = {},
): ProjectedCombatHistoryEvent {
  return {
    completeness: "complete",
    facts: { publicOutcome: {} },
    id: `history:${sequence}:${type}`,
    identities: [
      {
        displayName: "Scyrian cavalry guy",
        participantId: "scyrian",
        role: "attacker",
        visibility: "visible",
      },
      {
        displayName: "The Gladiator",
        participantId: "gladiator",
        role: "defender",
        visibility: "visible",
      },
    ],
    missingFacts: [],
    occurredAt: null,
    ownerParticipantId: "scyrian",
    phase: "phase1",
    roundNumber: 1,
    sequence,
    status: "recorded",
    step: "phase_1_actions",
    type,
    ...overrides,
  };
}

function logEvent(
  id: string,
  sequence: number,
  input: Pick<CombatLogEventPresentation, "category" | "summary" | "summaryFacts"> &
    Partial<CombatLogEventPresentation>,
): CombatLogEventPresentation {
  return {
    ...input,
    encounterId: "encounter-1",
    id,
    phase: "phase1",
    roundNumber: 1,
    sequence,
    sourceEventIds: input.sourceEventIds ?? [],
    sourceRevision: revision,
    state: input.state ?? "final",
  };
}

function log(events: readonly CombatLogEventPresentation[]): CombatLogProjection {
  return { encounterId: "encounter-1", events, sourceRevision: revision };
}

function build(input: {
  boundary?:
    | "declaration"
    | "phase1_resolution"
    | "phase2_modifier_review"
    | "phase2_resolution"
    | "round_end";
  events?: readonly ProjectedCombatHistoryEvent[];
  logEvents?: readonly CombatLogEventPresentation[];
  participantId?: string;
  viewer?: "gm" | "player";
}) {
  return buildCombatStepResultPresentation({
    boundary: input.boundary ?? "phase1_resolution",
    combatLog: log(input.logEvents ?? []),
    encounterId: "encounter-1",
    encounterRevision: revision,
    events: input.events ?? [],
    participantId: input.participantId ?? "gladiator",
    roundNumber: 1,
    viewer: { kind: input.viewer ?? "player" },
  });
}

describe("buildCombatStepResultPresentation", () => {
  const attempt = logEvent("log:attempt", 0, {
    actor: { displayName: "Scyrian cavalry guy", participantId: "scyrian" },
    category: "attempt",
    phase: "phase1",
    proposalId: "proposal-1",
    sourceEventIds: ["proposal-1", "history:1:adjust_distance_response"],
    summary: "Scyrian cavalry guy attempted to move closer to The Gladiator.",
    summaryFacts: {
      currentDistance: 3,
      direction: "closer",
      kind: "maneuver_attempt",
      maneuver: "adjust_distance",
      requestedDistance: 2,
    },
    target: { displayName: "The Gladiator", participantId: "gladiator" },
  });
  const response = logEvent("log:response", 1, {
    actor: { displayName: "The Gladiator", participantId: "gladiator" },
    category: "response",
    proposalId: "proposal-1",
    sourceEventIds: ["history:1:adjust_distance_response"],
    summary: "The Gladiator opposed the movement.",
    summaryFacts: {
      kind: "participant_response",
      maneuver: "adjust_distance",
      response: "opposed",
    },
    target: { displayName: "Scyrian cavalry guy", participantId: "scyrian" },
  });
  const contest = logEvent("log:contest", 2, {
    actor: { displayName: "Scyrian cavalry guy", participantId: "scyrian" },
    category: "contest",
    proposalId: "proposal-1",
    sourceEventIds: ["history:4:adjust_distance_committed"],
    summary: "Scyrian cavalry guy lost the distance contest.",
    summaryFacts: {
      contest: "adjust_distance",
      kind: "contest_resolved",
      outcome: "lost",
    },
    target: { displayName: "The Gladiator", participantId: "gladiator" },
  });
  const attack = logEvent("log:attack", 3, {
    actor: { displayName: "The Gladiator", participantId: "gladiator" },
    attackResultId: "attack-1",
    category: "attack",
    sourceEventIds: ["history:5:attack"],
    summary: "The Gladiator attacked Scyrian cavalry guy. The attack missed.",
    summaryFacts: { kind: "attack_resolved", outcome: "missed" },
    target: { displayName: "Scyrian cavalry guy", participantId: "scyrian" },
  });
  const responseEvent = historyEvent("adjust_distance_response", 1, {
    facts: { involvedOutcome: { proposalId: "proposal-1", response: "oppose" }, publicOutcome: {} },
  });
  const attackerRoll = historyEvent("adjust_distance_roll", 2, {
    facts: {
      involvedOutcome: { proposalId: "proposal-1", side: "attacker" },
      publicOutcome: {},
    },
    ownerParticipantId: "scyrian",
  });
  const defenderRoll = historyEvent("adjust_distance_roll", 3, {
    facts: {
      involvedOutcome: { proposalId: "proposal-1", side: "defender" },
      privateCalculation: {
        dodgeSkillTotal: 17,
        finalTotal: 24,
        generalFatigueModifier: 0,
        openEndedD10s: [],
        rollD20: 7,
        rollTotal: 7,
        situationalAdjustment: 0,
      },
      publicOutcome: {},
    },
    ownerParticipantId: "gladiator",
  });
  const committed = historyEvent("adjust_distance_committed", 4, {
    facts: {
      involvedOutcome: {
        committedDistance: 3,
        outcome: "unsuccessful",
        previousDistance: 3,
        proposalId: "proposal-1",
      },
      publicOutcome: {},
    },
  });
  const attackEvent = historyEvent("attack", 5, {
    facts: {
      involvedOutcome: { hit: false, tableResult: "Miss" },
      privateCalculation: { defenderDb: 13, lookupTotal: -1, ob: 8, rollTotal: 4 },
      publicOutcome: { hit: false },
    },
    ownerParticipantId: "gladiator",
  });

  it("accumulates maneuver, response, contest, unchanged distance, and later attack in A1", () => {
    const result = build({
      events: [responseEvent, attackerRoll, defenderRoll, committed, attackEvent],
      logEvents: [attempt, response, contest, attack],
    });

    expect(result.entries.map((entry) => entry.category)).toEqual([
      "maneuver",
      "maneuver",
      "contest",
      "distance",
      "attack",
    ]);
    expect(result.entries.map((entry) => entry.summary)).toContain("Distance remained 3.");
    expect(result.entries.at(-1)?.summary).toContain("attack missed");
  });

  it("never infers an unresolved opponent roll after the contest is resolved", () => {
    const result = build({
      events: [responseEvent, attackerRoll, defenderRoll, committed],
      logEvents: [attempt, response, contest],
    });
    const text = JSON.stringify(result);

    expect(text).not.toContain("Awaiting opponent roll");
    expect(result.entries.find((entry) => entry.id.includes("attempt"))?.state).toBe("final");
    expect(
      result.entries.find((entry) => entry.category === "contest")?.calculations[0]?.lines,
    ).toContain("Result: 24");
  });

  it("keeps a genuinely unresolved maneuver pending without requiring private opponent facts", () => {
    const result = build({ events: [responseEvent, defenderRoll], logEvents: [attempt, response] });

    expect(result.entries.find((entry) => entry.id.includes("attempt"))?.state).toBe("pending");
  });

  it("clears A1 entries immediately when the active boundary advances to M2", () => {
    const result = build({
      boundary: "phase2_modifier_review",
      events: [responseEvent, attackerRoll, defenderRoll, committed, attackEvent],
      logEvents: [attempt, response, contest, attack],
    });

    expect(result.entries).toEqual([]);
    expect(result.emptyState).toBe("No results recorded for this character in the current step.");
  });

  it("filters unrelated third-party results", () => {
    const result = build({
      events: [attackEvent],
      logEvents: [attack],
      participantId: "observer",
    });

    expect(result.entries).toEqual([]);
  });

  it("gives the GM every projected calculation while a player receives only sanitized own facts", () => {
    const gmAttackerRoll = {
      ...attackerRoll,
      facts: {
        ...attackerRoll.facts,
        privateCalculation: {
          dodgeSkillTotal: 15,
          finalTotal: 18,
          generalFatigueModifier: 0,
          openEndedD10s: [],
          rollD20: 3,
          rollTotal: 3,
          situationalAdjustment: 0,
        },
      },
    } satisfies ProjectedCombatHistoryEvent;
    const player = build({
      events: [gmAttackerRoll, defenderRoll, committed],
      logEvents: [contest],
    });
    const gm = build({
      events: [gmAttackerRoll, defenderRoll, committed],
      logEvents: [contest],
      viewer: "gm",
    });

    // The viewer projection enforces ownership even if a caller supplies an unsanitized event.
    const sanitizedPlayer = build({ events: [attackerRoll, defenderRoll, committed], logEvents: [contest] });
    expect(gm.entries[0]?.calculations).toHaveLength(2);
    expect(player.entries[0]?.calculations).toHaveLength(1);
    expect(sanitizedPlayer.entries[0]?.calculations).toHaveLength(1);
    expect(sanitizedPlayer.entries[0]?.calculations[0]?.visibility).toBe("own");
    expect(gm.entries[0]?.calculations.every((calculation) => calculation.visibility === "gm_full")).toBe(true);
  });

  it("fails closed instead of mixing contradictory revisions", () => {
    const result = buildCombatStepResultPresentation({
      boundary: "phase1_resolution",
      combatLog: { ...log([attack]), sourceRevision: "older" },
      encounterId: "encounter-1",
      encounterRevision: revision,
      events: [attackEvent],
      participantId: "gladiator",
      roundNumber: 1,
      viewer: { kind: "player" },
    });

    expect(result.entries).toEqual([]);
  });

  it("is deterministic across reload and removes only undone authoritative events", () => {
    const input = {
      events: [responseEvent, attackerRoll, defenderRoll, committed, attackEvent],
      logEvents: [attempt, response, contest, attack],
    };
    expect(build(input)).toEqual(build(input));

    const undone = build({
      events: [responseEvent, attackerRoll, defenderRoll, committed],
      logEvents: [attempt, response, contest],
    });
    expect(undone.entries.some((entry) => entry.category === "attack")).toBe(false);
    expect(undone.entries.some((entry) => entry.category === "contest")).toBe(true);
  });

  it("uses an explicit recorded result event before GM commit without stale pending prose", () => {
    const resultEvent = historyEvent("adjust_distance_result", 4, {
      facts: {
        involvedOutcome: {
          outcome: "successful",
          proposalId: "proposal-1",
          proposedDistance: 2,
        },
        publicOutcome: {},
      },
    });
    const result = build({
      events: [responseEvent, attackerRoll, defenderRoll, resultEvent],
      logEvents: [attempt, response],
    });

    expect(result.entries.find((entry) => entry.category === "contest")?.summary).toContain("won");
    expect(result.entries.find((entry) => entry.id.includes("attempt"))?.state).toBe("final");
  });

  it("keeps defense, critical, damage, and condition outcomes with an involved attack", () => {
    const defense = logEvent("log:defense", 4, {
      actor: { displayName: "Scyrian cavalry guy", participantId: "scyrian" },
      category: "defense",
      sourceEventIds: ["history:6:parry"],
      summary: "Scyrian cavalry guy failed to parry the attack.",
      summaryFacts: { defense: "parry", kind: "defense_resolved", outcome: "failed" },
      target: { displayName: "The Gladiator", participantId: "gladiator" },
    });
    const damage = logEvent("log:damage", 6, {
      actor: { displayName: "The Gladiator", participantId: "gladiator" },
      category: "damage",
      sourceEventIds: ["history:8:damage_committed"],
      summary: "Scyrian cavalry guy suffered 8 damage.",
      summaryFacts: { amount: 8, kind: "damage_committed", source: "attack" },
      target: { displayName: "Scyrian cavalry guy", participantId: "scyrian" },
    });
    const condition = logEvent("log:condition", 7, {
      actor: { displayName: "The Gladiator", participantId: "gladiator" },
      category: "condition",
      sourceEventIds: ["history:8:damage_committed"],
      summary: "Scyrian cavalry guy began bleeding.",
      summaryFacts: { conditionLabel: "Bleeding", kind: "condition_applied" },
      target: { displayName: "Scyrian cavalry guy", participantId: "scyrian" },
    });
    const critical = historyEvent("critical", 7, {
      facts: {
        involvedOutcome: { attackResultId: "attack-1", resultLabel: "Bleeding wound" },
        publicOutcome: {},
      },
    });

    const result = build({
      events: [attackEvent, historyEvent("parry", 6), critical, historyEvent("damage_committed", 8)],
      logEvents: [attack, defense, damage, condition],
    });

    expect(result.entries.map((entry) => entry.category)).toEqual([
      "attack",
      "defense",
      "critical",
      "damage",
      "condition",
    ]);
    expect(result.entries.map((entry) => entry.summary).join(" ")).not.toMatch(
      /proposal|process|execution group|modifier validation/i,
    );
  });

  it("shows round-end Health outcomes only during the round-end boundary", () => {
    const health = historyEvent("health_check", 10, {
      facts: {
        involvedOutcome: { success: true },
        privateCalculation: {
          characteristic: 13,
          finalTotal: 19,
          generalFatigueModifier: 0,
          rollD20: 6,
          situationalAdjustment: 0,
        },
        publicOutcome: { completed: true },
      },
      identities: [
        {
          displayName: "The Gladiator",
          participantId: "gladiator",
          role: "actor",
          visibility: "visible",
        },
      ],
      ownerParticipantId: "gladiator",
      phase: undefined,
      step: "round_summary",
    });

    const roundEnd = build({ boundary: "round_end", events: [health] });
    const laterPhase = build({ boundary: "phase2_resolution", events: [health] });

    expect(roundEnd.entries).toHaveLength(1);
    expect(roundEnd.entries[0]).toMatchObject({ category: "review", state: "final" });
    expect(laterPhase.entries).toEqual([]);
  });

  it("shows a rolled Combat Experience result immediately and clears it after declaration", () => {
    const combatExperience = historyEvent("combat_experience", 1, {
      facts: {
        involvedOutcome: {
          difficulty: 26,
          finalTotal: 27,
          resultBand: "active",
          resultLabel: "Active",
          success: true,
        },
        privateCalculation: {
          difficulty: 26,
          finalTotal: 27,
          openEndedD10s: [],
          rollD20: 17,
          rollTotal: 17,
          skillTotal: 10,
        },
        publicOutcome: {},
      },
      identities: [
        {
          displayName: "The Gladiator",
          participantId: "gladiator",
          role: "actor",
          visibility: "visible",
        },
        {
          displayName: "The Gladiator",
          participantId: "gladiator",
          role: "roller",
          visibility: "visible",
        },
      ],
      ownerParticipantId: "gladiator",
      phase: undefined,
      step: "select_actions",
    });

    const declaration = build({ boundary: "declaration", events: [combatExperience] });
    const modifierReview = build({
      boundary: "phase2_modifier_review",
      events: [combatExperience],
    });

    expect(declaration.entries).toHaveLength(1);
    expect(declaration.entries[0]).toMatchObject({
      category: "review",
      heading: "Combat Experience",
      outcome: "Result: 27 vs 26",
      state: "final",
      summary: "Succeeded.",
    });
    expect(declaration.entries[0]?.calculations[0]).toMatchObject({
      collapsedByDefault: true,
      title: "Combat Experience",
      visibility: "own",
    });
    expect(modifierReview.entries).toEqual([]);
    expect(JSON.stringify(declaration)).not.toContain("combat log");
  });

  it("does not render declaration content in live results before publication", () => {
    const ownDeclaration = logEvent("log:own-declaration", 1, {
      actor: { displayName: "The Gladiator", participantId: "gladiator" },
      category: "declaration",
      phase: "declaration",
      summary: "you declared Single Attack against Scyrian cavalry guy.",
      summaryFacts: {
        actionId: "attack_parry",
        actionLabel: "Single Attack",
        kind: "declaration_submitted",
      },
    });

    expect(
      build({ boundary: "declaration", logEvents: [ownDeclaration] }).entries,
    ).toEqual([]);
  });

  it("preserves safe hidden-identity wording without exposing a participant id", () => {
    const hiddenAttack = logEvent("log:hidden-attack", 9, {
      actor: { displayName: "another combatant" },
      category: "attack",
      sourceEventIds: ["history:hidden:attack"],
      summary: "Another combatant attacked The Gladiator. The attack missed.",
      summaryFacts: { kind: "attack_resolved", outcome: "missed" },
      target: { displayName: "The Gladiator", participantId: "gladiator" },
    });

    const result = build({ logEvents: [hiddenAttack] });

    expect(result.entries[0]?.actor).toEqual({
      hidden: true,
      id: undefined,
      label: "another combatant",
    });
    expect(JSON.stringify(result)).not.toContain("scyrian");
  });
});

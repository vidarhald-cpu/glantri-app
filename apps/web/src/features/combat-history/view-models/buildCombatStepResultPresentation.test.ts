import { describe, expect, it } from "vitest";
import type {
  CombatLogEventPresentation,
  CombatLogProjection,
  CombatResultEnvelope,
  ProjectedCombatHistoryEvent,
} from "@glantri/domain";

import { buildCombatStepResultPresentation } from "./buildCombatStepResultPresentation";
import { buildCombatEventResultModel } from "./buildCombatEventResultModel";
import {
  buildCombatCalculationPresentationLines,
  type CombatCalculationPresentation,
} from "./combatCalculationPresentation";

const revision = "2026-07-21T12:00:00.000Z";

function calculationLines(
  calculation: CombatCalculationPresentation | undefined,
): readonly string[] {
  return calculation ? buildCombatCalculationPresentationLines(calculation) : [];
}

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

function resultEnvelope(): CombatResultEnvelope {
  return {
    actionType: "adjust_distance_committed",
    affectedParticipants: [],
    calculationReferences: [],
    committedConsequences: [{ key: "distance", label: "Distance", value: 2 }],
    conciseOutcome: { details: ["Distance 2"], label: "Distance committed" },
    participants: [],
    privateDiagnostics: [],
    provenance: {
      completeness: "complete",
      occurredAt: null,
      sourceIds: [],
      sourceKind: "canonical",
    },
    publicCombatNote: "The combatants circle toward the doorway.",
    resultId: "history:1:adjust_distance_committed",
    round: 1,
    schemaVersion: 1,
    sequence: 1,
    standardConsequences: [{ key: "distance", label: "Distance", value: 2 }],
    step: "phase_1_actions",
    subordinateEventReferences: [],
    targets: [],
    visibility: {
      calculationAccess: "none",
      outcomeScope: "involved",
      privateDiagnosticsIncluded: false,
    },
  };
}

describe("buildCombatStepResultPresentation", () => {
  it("uses semantically equivalent calculation rows for current and historical presentation", () => {
    const sourceEvent = historyEvent("attack", 1, {
      facts: {
        involvedOutcome: { attackResultId: "attack-1", hit: true },
        privateCalculation: { defenderDb: 15, lookupTotal: 6, ob: 11, rollTotal: 10 },
        publicOutcome: { hit: true },
      },
      id: "history:attack-1",
      ownerParticipantId: "scyrian",
    });
    const current = build({
      events: [sourceEvent],
      logEvents: [
        logEvent("log:attack-1", 1, {
          attackResultId: "attack-1",
          category: "attack",
          sourceEventIds: [sourceEvent.id],
          summary: "Scyrian cavalry guy attacked The Gladiator.",
          summaryFacts: { kind: "attack_resolved", outcome: "hit" },
        }),
      ],
      participantId: "scyrian",
      viewer: "player",
    });
    const historical = buildCombatEventResultModel([sourceEvent]);

    expect(calculationLines(current.entries[0]?.calculations[0])).toEqual(
      historical.items[0]?.calculationRows.map((row) => row.text),
    );
  });

  it("attaches the same canonical envelope facts to current-step presentation", () => {
    const envelope = resultEnvelope();
    const sourceEvent = historyEvent("adjust_distance_committed", 1, {
      id: envelope.resultId,
      resultEnvelope: envelope,
    });
    const result = build({
      events: [sourceEvent],
      logEvents: [
        logEvent("log:distance", 1, {
          category: "contest",
          sourceEventIds: [sourceEvent.id],
          summary: "The combatants changed distance.",
          summaryFacts: {
            kind: "distance_changed",
            nextDistance: 2,
            previousDistance: 3,
          },
        }),
      ],
    });

    expect(result.entries[0]?.resultEnvelopes).toEqual([envelope]);
  });

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
      calculationLines(
        result.entries.find((entry) => entry.category === "contest")?.calculations[0],
      ),
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
    const sanitizedPlayer = build({
      events: [attackerRoll, defenderRoll, committed],
      logEvents: [contest],
    });
    expect(gm.entries[0]?.calculations).toHaveLength(2);
    expect(player.entries[0]?.calculations).toHaveLength(1);
    expect(sanitizedPlayer.entries[0]?.calculations).toHaveLength(1);
    expect(sanitizedPlayer.entries[0]?.calculations[0]?.visibility).toBe("own");
    expect(
      gm.entries[0]?.calculations.every((calculation) => calculation.visibility === "gm_full"),
    ).toBe(true);
  });

  it("presents the observation contest in the completing round's SU results", () => {
    const observerEvent = historyEvent("observation", 7, {
      facts: {
        involvedOutcome: {
          bestBonusAfter: 3,
          candidateBonus: 3,
          difference: 16,
        },
        privateCalculation: {
          appliedModifiers: [{ bucket: "general_fatigue", label: "CE", value: 1 }],
          effectiveSkillValue: 20,
          finalTotal: 38,
          intelligenceValue: 11,
          intelligenceXp: 2,
          openEndedD10s: [],
          rollD20: 18,
          rollTotal: 18,
          skillLabel: "Dodge",
          skillXp: 7,
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
        {
          displayName: "Scyrian cavalry guy",
          participantId: "scyrian",
          role: "target",
          visibility: "visible",
        },
      ],
      ownerParticipantId: "gladiator",
      phase: undefined,
      step: "round_summary",
    });
    const gmEvent = {
      ...observerEvent,
      facts: {
        ...observerEvent.facts,
        gmReview: {
          observerTotal: 38,
          targetCalculation: {
            appliedModifiers: [],
            effectiveSkillValue: 12,
            finalTotal: 22,
            intelligenceValue: 9,
            intelligenceXp: 1,
            openEndedD10s: [],
            rollD20: 10,
            rollTotal: 10,
            skillLabel: "One-handed edged",
            skillXp: 2,
          },
          targetTotal: 22,
        },
      },
    } satisfies ProjectedCombatHistoryEvent;

    const observer = build({
      boundary: "round_end",
      events: [observerEvent],
      participantId: "gladiator",
    });
    const gm = build({
      boundary: "round_end",
      events: [gmEvent],
      participantId: "gladiator",
      viewer: "gm",
    });
    const observedTarget = build({
      boundary: "round_end",
      events: [],
      participantId: "scyrian",
    });

    expect(observer.entries[0]).toMatchObject({
      heading: "Observe Opponent — Scyrian cavalry guy",
      outcome: "Won by 16 · result +3% · best +3%",
      summary: "Roll 38",
    });
    expect(gm.entries[0]?.summary).toBe("Observer 38 vs opponent 22");
    expect(gm.entries[0]?.calculations.map((calculation) => calculation.label)).toEqual([
      "Observer — The Gladiator",
      "Opponent — Scyrian cavalry guy",
    ]);
    expect(observer.entries[0]?.calculations.map((calculation) => calculation.label)).toEqual([
      "Observer — The Gladiator",
    ]);
    expect(observedTarget.entries).toEqual([]);
  });

  it("presents concise observation progress and suppresses pending once its contest resolves", () => {
    const pending = historyEvent("observation", 5, {
      facts: {
        involvedOutcome: {
          observationAttemptId: "attempt-1",
          observationStatus: "period_complete",
          requiredQualifyingRounds: 3,
          roundsTowardNextAttempt: 3,
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
          displayName: "Scyrian cavalry guy",
          participantId: "scyrian",
          role: "target",
          visibility: "visible",
        },
      ],
      ownerParticipantId: "gladiator",
      step: "round_summary",
    });
    const resolved = historyEvent("observation", 6, {
      ...pending,
      facts: {
        involvedOutcome: {
          bestBonusAfter: 1,
          candidateBonus: 1,
          difference: 8,
          observationAttemptId: "attempt-1",
        },
        publicOutcome: {},
      },
      id: "resolved-observation",
      sequence: 6,
    });
    const result = build({
      boundary: "round_end",
      events: [pending, resolved],
      participantId: "gladiator",
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.outcome).toBe("Won by 8 · result +1% · best +1%");
    expect(result.entries[0]?.summary).not.toContain("contest resolved");
  });

  it("states why a hit-disqualified observation round made no progress", () => {
    const noProgress = historyEvent("observation", 5, {
      facts: {
        involvedOutcome: {
          observationNoProgressReason: "observer_hit",
          observationStatus: "no_progress",
          requiredQualifyingRounds: 3,
          roundsTowardNextAttempt: 1,
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
          displayName: "Scyrian cavalry guy",
          participantId: "scyrian",
          role: "target",
          visibility: "visible",
        },
      ],
      ownerParticipantId: "gladiator",
      step: "round_summary",
    });

    const result = build({
      boundary: "round_end",
      events: [noProgress],
      participantId: "gladiator",
    });

    expect(result.entries[0]).toMatchObject({
      heading: "Observe Opponent — Scyrian cavalry guy",
      summary: "No progress · observer was hit",
    });
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
      events: [
        attackEvent,
        historyEvent("parry", 6),
        critical,
        historyEvent("damage_committed", 8),
      ],
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
      label: "Combat Experience",
      visibility: "own",
    });
    expect(modifierReview.entries).toEqual([]);
    expect(JSON.stringify(declaration)).not.toContain("combat log");
  });

  it("shows phase Combat Experience in A2 with its consequence and keeps it out of A1", () => {
    const combatExperience = historyEvent("combat_experience", 2, {
      facts: {
        involvedOutcome: {
          difficulty: 26,
          finalTotal: 18,
          modifierValue: -2,
          phaseAttackCancelled: false,
          resultBand: "active_penalty",
          resultLabel: "Attack continues",
          success: false,
        },
        privateCalculation: {
          difficulty: 26,
          finalTotal: 18,
          rollD20: 8,
          rollTotal: 8,
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
      opportunityId: "gladiator-phase2-opportunity",
      ownerParticipantId: "gladiator",
      phase: "phase2",
      step: "phase_2_actions",
    });

    const phase2 = build({
      boundary: "phase2_resolution",
      events: [combatExperience],
      participantId: "gladiator",
    });
    const phase1 = build({
      boundary: "phase1_resolution",
      events: [combatExperience],
      participantId: "gladiator",
    });

    expect(phase2.entries).toHaveLength(1);
    expect(phase2.entries[0]).toMatchObject({
      heading: "Combat Experience",
      opportunityId: "gladiator-phase2-opportunity",
      outcome: "Result: 18 vs 26",
      summary: "Failed — the attack may continue with -2 Skill/OB.",
    });
    expect(phase2.entries[0]?.calculations).toHaveLength(1);
    expect(phase1.entries).toEqual([]);
  });

  it("shows an involved opponent the phase CE outcome without the roller calculation", () => {
    const combatExperience = historyEvent("combat_experience", 2, {
      facts: {
        involvedOutcome: {
          difficulty: 26,
          finalTotal: 27,
          modifierValue: 0,
          phaseAttackCancelled: false,
          success: true,
        },
        privateCalculation: {
          difficulty: 26,
          finalTotal: 27,
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
        {
          displayName: "Scyrian cavalry guy",
          participantId: "scyrian",
          role: "target",
          visibility: "visible",
        },
      ],
      ownerParticipantId: "gladiator",
      phase: "phase2",
      step: "phase_2_actions",
    });

    const opponent = build({
      boundary: "phase2_resolution",
      events: [combatExperience],
      participantId: "scyrian",
    });

    expect(opponent.entries).toHaveLength(1);
    expect(opponent.entries[0]).toMatchObject({
      heading: "Combat Experience",
      summary: "Succeeded — the attack may continue.",
    });
    expect(opponent.entries[0]?.outcome).toBeUndefined();
    expect(opponent.entries[0]?.calculations).toEqual([]);
  });

  it("presents a graze roll to both participants while keeping its calculation with the roller", () => {
    const graze = historyEvent("damage_proposed", 7, {
      facts: {
        involvedOutcome: {
          attackResultId: "attack-graze",
          damageRollExpression: "1d7",
          grazing: true,
          rawGrazingDamage: 3,
          totalDamage: 3,
        },
        publicOutcome: {},
      },
      identities: [
        {
          displayName: "The Gladiator",
          participantId: "gladiator",
          role: "attacker",
          visibility: "visible",
        },
        {
          displayName: "Scyrian cavalry guy",
          participantId: "scyrian",
          role: "defender",
          visibility: "visible",
        },
      ],
      ownerParticipantId: "scyrian",
    });

    const attacker = build({ events: [graze], participantId: "gladiator" });
    const defender = build({ events: [graze], participantId: "scyrian" });
    const gm = build({ events: [graze], participantId: "scyrian", viewer: "gm" });

    expect(attacker.entries[0]).toMatchObject({
      calculations: [
        {
          calculationType: "damage",
          die: { rolledValue: 3 },
          visibility: "own",
        },
      ],
      heading: "Graze damage",
      summary: "You rolled 3 on 1d7. Damage is awaiting GM review.",
    });
    expect(defender.entries[0]).toMatchObject({
      calculations: [],
      summary: "The Gladiator rolled 3 damage. Damage is awaiting GM review.",
    });
    expect(gm.entries[0]).toMatchObject({
      calculations: [expect.objectContaining({ visibility: "gm_full" })],
      summary:
        "The Gladiator rolled 3 on 1d7 against Scyrian cavalry guy. Review damage and effects.",
    });
  });

  it("presents a resolved Offensive Parry contest with participant-safe calculations", () => {
    const controllerRoll = historyEvent("offensive_parry_brawling", 10, {
      facts: {
        involvedOutcome: {
          affectedParticipantId: "scyrian",
          affectedTotal: undefined,
          attackResultId: "attack-1",
          contactEstablished: false,
          contestId: "contest-1",
          controllerParticipantId: "gladiator",
          controllerTotal: 31,
          resolved: false,
        },
        privateCalculation: {
          brawlingBaseValue: 12,
          finalTotal: 31,
          generalModifier: 0,
          parryQualityModifier: 2,
          rollD20: 17,
          rollTotal: 17,
          skillModifier: 0,
        },
        publicOutcome: { contactEstablished: false, resolved: false },
      },
      identities: [
        {
          displayName: "The Gladiator",
          participantId: "gladiator",
          role: "defender",
          visibility: "visible",
        },
        {
          displayName: "The Gladiator",
          participantId: "gladiator",
          role: "roller",
          visibility: "visible",
        },
        {
          displayName: "Scyrian cavalry guy",
          participantId: "scyrian",
          role: "attacker",
          visibility: "visible",
        },
      ],
      opportunityId: "opportunity-1",
      ownerParticipantId: "gladiator",
    });
    const responderRoll = historyEvent("offensive_parry_brawling", 11, {
      facts: {
        involvedOutcome: {
          affectedParticipantId: "scyrian",
          affectedTotal: 22,
          attackResultId: "attack-1",
          contactEstablished: true,
          contestId: "contest-1",
          controllerParticipantId: "gladiator",
          controllerTotal: 31,
          difference: 9,
          resolved: true,
          winnerParticipantId: "gladiator",
        },
        privateCalculation: {
          brawlingBaseValue: 9,
          finalTotal: 22,
          generalModifier: 0,
          parryQualityModifier: 0,
          rollD20: 13,
          rollTotal: 13,
          skillModifier: 0,
        },
        publicOutcome: {
          contactEstablished: true,
          resolved: true,
          winnerParticipantId: "gladiator",
        },
      },
      identities: [
        {
          displayName: "The Gladiator",
          participantId: "gladiator",
          role: "defender",
          visibility: "visible",
        },
        {
          displayName: "Scyrian cavalry guy",
          participantId: "scyrian",
          role: "attacker",
          visibility: "visible",
        },
        {
          displayName: "Scyrian cavalry guy",
          participantId: "scyrian",
          role: "roller",
          visibility: "visible",
        },
      ],
      opportunityId: "opportunity-1",
      ownerParticipantId: "scyrian",
    });

    const controller = build({
      events: [controllerRoll, responderRoll],
      participantId: "gladiator",
    });
    const affected = build({
      events: [controllerRoll, responderRoll],
      participantId: "scyrian",
    });
    const gm = build({
      events: [controllerRoll, responderRoll],
      participantId: "gladiator",
      viewer: "gm",
    });

    expect(controller.entries).toEqual([
      expect.objectContaining({
        calculations: [expect.objectContaining({ visibility: "own" })],
        heading: "Offensive Parry — Brawling",
        summary:
          "You won the Brawling contest. Continued contact was established. Scyrian cavalry guy is Unbalanced (−2%).",
      }),
    ]);
    expect(affected.entries).toEqual([
      expect.objectContaining({
        calculations: [expect.objectContaining({ visibility: "own" })],
        summary:
          "You lost the Brawling contest. The Gladiator established continued contact. You are Unbalanced (−2%).",
      }),
    ]);
    expect(calculationLines(controller.entries[0]?.calculations[0])).toEqual(
      expect.arrayContaining(["Base skill: 12", "Skill total: 14"]),
    );
    expect(calculationLines(controller.entries[0]?.calculations[0])).not.toContain("Die roll: 13");
    expect(gm.entries[0]?.calculations).toHaveLength(2);
    expect(gm.entries[0]?.calculations[0]).toMatchObject({ visibility: "gm_full" });
    expect(gm.entries[0]?.calculations.flatMap(calculationLines)).toEqual(
      expect.arrayContaining(["Skill total: 14", "Skill total: 9"]),
    );
    expect(gm.entries[0]?.calculations.flatMap(calculationLines).join(" ")).not.toMatch(
      /difference|wins|consequence/i,
    );
  });

  it("presents one concise Continued Contact maintenance result and treats a tie as escape", () => {
    const identities = [
      {
        displayName: "The Gladiator",
        participantId: "gladiator",
        role: "actor" as const,
        visibility: "visible" as const,
      },
      {
        displayName: "Scyrian cavalry guy",
        participantId: "scyrian",
        role: "target" as const,
        visibility: "visible" as const,
      },
    ];
    const controllerRoll = historyEvent("continued_contact_maintenance", 20, {
      facts: {
        involvedOutcome: {
          affectedParticipantId: "scyrian",
          contestId: "maintenance-1",
          controllerParticipantId: "gladiator",
          controllerTotal: 24,
          resolved: false,
        },
        privateCalculation: {
          brawlingBaseValue: 14,
          finalTotal: 24,
          generalModifier: 0,
          rollD20: 10,
          rollTotal: 10,
          skillModifier: 0,
        },
        publicOutcome: { resolved: false },
      },
      identities: [
        ...identities,
        {
          displayName: "The Gladiator",
          participantId: "gladiator",
          role: "roller",
          visibility: "visible",
        },
      ],
      ownerParticipantId: "gladiator",
      step: "round_summary",
    });
    const defenderRoll = historyEvent("continued_contact_maintenance", 21, {
      facts: {
        involvedOutcome: {
          affectedParticipantId: "scyrian",
          affectedTotal: 24,
          contactMaintained: false,
          contestId: "maintenance-1",
          controllerParticipantId: "gladiator",
          controllerTotal: 24,
          difference: 0,
          outcome: "tie",
          resolved: true,
        },
        privateCalculation: {
          brawlingBaseValue: 12,
          finalTotal: 24,
          generalModifier: 2,
          rollD20: 10,
          rollTotal: 10,
          skillModifier: 0,
        },
        publicOutcome: {
          contactMaintained: false,
          outcome: "tie",
          resolved: true,
        },
      },
      identities: [
        ...identities,
        {
          displayName: "Scyrian cavalry guy",
          participantId: "scyrian",
          role: "roller",
          visibility: "visible",
        },
      ],
      ownerParticipantId: "scyrian",
      step: "round_summary",
    });
    const gm = build({
      boundary: "round_end",
      events: [controllerRoll, defenderRoll],
      participantId: "gladiator",
      viewer: "gm",
    });

    expect(gm.entries).toHaveLength(1);
    expect(gm.entries[0]).toMatchObject({
      heading: "Continued Contact — Maintenance",
      outcome: "Tie · Continued Contact broken",
      summary:
        "Continued Contact was broken. Unbalanced was removed. Ordinary distance control resumes.",
    });
    expect(gm.entries[0]?.calculations).toHaveLength(2);
    expect(gm.entries[0]?.calculations.flatMap(calculationLines).join(" ")).not.toMatch(
      /difference|tie|consequence/i,
    );
  });

  it("attaches attack, parry, and final Brawling calculations only to their canonical results", () => {
    const attack = historyEvent("attack", 1, {
      facts: {
        involvedOutcome: { attackResultId: "attack-1", hit: false },
        privateCalculation: { defenderDb: 13, lookupTotal: 8, ob: 10, rollTotal: 11 },
        publicOutcome: { hit: false },
      },
      id: "history:attack-1",
    });
    const parry = historyEvent("parry", 2, {
      facts: {
        involvedOutcome: { attackResultId: "attack-1", success: true },
        privateCalculation: { combinedParryScore: 12, rollTotal: 11, total: 23 },
        publicOutcome: { success: true },
      },
      id: "history:parry-1",
      ownerParticipantId: "gladiator",
    });
    const controllerRoll = historyEvent("offensive_parry_brawling", 3, {
      facts: {
        involvedOutcome: {
          affectedParticipantId: "scyrian",
          attackResultId: "attack-1",
          contestId: "contest-1",
          controllerParticipantId: "gladiator",
          controllerTotal: 31,
          resolved: false,
        },
        privateCalculation: {
          brawlingBaseValue: 12,
          finalTotal: 31,
          generalModifier: 0,
          parryQualityModifier: 2,
          rollTotal: 17,
          skillModifier: 0,
        },
        publicOutcome: { resolved: false },
      },
      id: "history:brawling:gladiator",
      ownerParticipantId: "gladiator",
    });
    const responderRoll = historyEvent("offensive_parry_brawling", 4, {
      facts: {
        involvedOutcome: {
          affectedParticipantId: "scyrian",
          affectedTotal: 22,
          attackResultId: "attack-1",
          contactEstablished: true,
          contestId: "contest-1",
          controllerParticipantId: "gladiator",
          controllerTotal: 31,
          resolved: true,
          winnerParticipantId: "gladiator",
        },
        privateCalculation: {
          brawlingBaseValue: 9,
          finalTotal: 22,
          generalModifier: 0,
          parryQualityModifier: 0,
          rollTotal: 13,
          skillModifier: 0,
        },
        publicOutcome: {
          contactEstablished: true,
          resolved: true,
          winnerParticipantId: "gladiator",
        },
      },
      id: "history:brawling:scyrian",
      ownerParticipantId: "scyrian",
    });
    const result = build({
      events: [attack, parry, controllerRoll, responderRoll],
      logEvents: [
        logEvent("log:attack", 1, {
          attackResultId: "attack-1",
          category: "attack",
          sourceEventIds: [attack.id],
          summary: "Scyrian cavalry guy attacked The Gladiator. The attack missed.",
          summaryFacts: { kind: "attack_resolved", outcome: "missed" },
        }),
        logEvent("log:parry", 2, {
          attackResultId: "attack-1",
          category: "defense",
          sourceEventIds: [parry.id],
          summary:
            "The attack missed, but The Gladiator successfully intercepted the attack. Roll Brawling to establish continued contact.",
          summaryFacts: {
            defense: "parry",
            kind: "defense_resolved",
            outcome: "succeeded",
            parryPurpose: "offensive_parry",
          },
        }),
      ],
      participantId: "gladiator",
      viewer: "gm",
    });

    expect(result.entries.map((entry) => entry.heading)).toEqual([
      "Attack",
      "Offensive Parry",
      "Offensive Parry — Brawling",
    ]);
    expect(result.entries[0]?.calculations).toEqual([expect.objectContaining({ label: "Attack" })]);
    expect(result.entries[1]?.calculations).toEqual([expect.objectContaining({ label: "Parry" })]);
    expect(result.entries[2]?.calculations).toEqual([
      expect.objectContaining({ calculationType: "offensive_parry_brawling" }),
      expect.objectContaining({ calculationType: "offensive_parry_brawling" }),
    ]);
    expect(
      result.entries
        .slice(0, 2)
        .flatMap((entry) => entry.calculations)
        .flatMap(calculationLines),
    ).not.toContain("Skill total: 12");
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

    expect(build({ boundary: "declaration", logEvents: [ownDeclaration] }).entries).toEqual([]);
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

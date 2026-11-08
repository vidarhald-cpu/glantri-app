import type { CombatLogEventPresentation, ProjectedCombatHistoryEvent } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { buildCombatLastAction } from "./buildCombatLastAction";

const participants = [
  { label: "GangHo", participantId: "p-gangho" },
  { label: "Halgeir", participantId: "p-halgeir" },
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

function rawEvent(
  id: string,
  sequence: number,
  overrides: Partial<ProjectedCombatHistoryEvent> = {},
): ProjectedCombatHistoryEvent {
  return {
    completeness: "complete",
    facts: { publicOutcome: {} },
    id,
    identities: [],
    missingFacts: [],
    occurredAt: null,
    roundNumber: 1,
    sequence,
    status: "recorded",
    step: "declaration",
    type: "declaration",
    ...overrides,
  } as ProjectedCombatHistoryEvent;
}

const declaration = logEvent("l-decl", "ev-decl", {
  actor: { displayName: "GangHo", participantId: "p-gangho" },
  phase: "declaration",
  summaryFacts: { actionLabel: "Parry", kind: "declaration_submitted" },
});
const attackMiss = logEvent("l-atk", "ev-atk", {
  actor: { displayName: "Halgeir", participantId: "p-halgeir" },
  category: "attack",
  phase: "phase1",
  summaryFacts: { kind: "attack_resolved", outcome: "missed" },
  target: { displayName: "GangHo", participantId: "p-gangho" },
});

describe("buildCombatLastAction", () => {
  it("names the declaring actor", () => {
    const result = buildCombatLastAction({
      gmEvents: [rawEvent("ev-decl", 1)],
      logEvents: [declaration],
      participants,
      roundNumber: 1,
    });
    expect(result?.text).toBe("GangHo declared Parry");
  });

  it("names the attacker, the target and the outcome for a miss and a hit", () => {
    const gmEvents = [rawEvent("ev-atk", 2)];
    expect(
      buildCombatLastAction({ gmEvents, logEvents: [attackMiss], participants, roundNumber: 1 })
        ?.text,
    ).toBe("Halgeir attacked GangHo — miss");
    const hit = {
      ...attackMiss,
      summaryFacts: { kind: "attack_resolved", outcome: "hit" },
    } as CombatLogEventPresentation;
    expect(
      buildCombatLastAction({ gmEvents, logEvents: [hit], participants, roundNumber: 1 })?.text,
    ).toBe("Halgeir attacked GangHo — hit");
  });

  it("names the roller of an initiative roll and orders it against log events", () => {
    const gmEvents = [
      rawEvent("ev-decl", 1),
      rawEvent("ev-atk", 2),
      rawEvent("ev-init", 3, {
        facts: { publicOutcome: { total: 14 } },
        ownerParticipantId: "p-gangho",
        phase: "phase2",
        type: "initiative",
      }),
    ];
    expect(
      buildCombatLastAction({
        gmEvents,
        logEvents: [declaration, attackMiss],
        participants,
        roundNumber: 1,
      })?.text,
    ).toBe("GangHo rolled Initiative 14");
  });

  it("orders by Combat Log position even when no raw source event resolves", () => {
    expect(
      buildCombatLastAction({
        gmEvents: [rawEvent("unrelated", 40)],
        logEvents: [declaration, attackMiss],
        participants,
        roundNumber: 1,
      })?.text,
    ).toBe("Halgeir attacked GangHo — miss");
  });

  it("places an individual initiative roll by phase so later log entries outrank it", () => {
    const inPhase = (event: CombatLogEventPresentation, phase: "phase1" | "phase2") =>
      ({ ...event, phase }) as CombatLogEventPresentation;
    const damage = inPhase(
      logEvent("l-dmg", "legacy-dmg", {
        actor: { displayName: "Halgeir", participantId: "p-halgeir" },
        category: "damage",
        summaryFacts: { amount: 7, kind: "damage_committed", source: "attack" },
        target: { displayName: "GangHo", participantId: "p-gangho" },
      }),
      "phase1",
    );
    const phase1Initiative = rawEvent("ev-init", 4, {
      facts: { publicOutcome: { total: 5 } },
      ownerParticipantId: "p-gangho",
      phase: "phase1",
      type: "initiative",
    });
    const gmEvents = [rawEvent("ev-decl", 1), phase1Initiative];
    // Declaration, then phase 1 initiative, then the attack and its damage (legacy-derived log
    // entries whose source events are not in `gmEvents`).
    const attack = inPhase(attackMiss, "phase1");
    expect(
      buildCombatLastAction({
        gmEvents,
        logEvents: [declaration, attack, damage],
        participants,
        roundNumber: 1,
      })?.text,
    ).toBe("Halgeir dealt 7 damage to GangHo");
    expect(
      buildCombatLastAction({
        gmEvents,
        logEvents: [declaration, attack],
        participants,
        roundNumber: 1,
      })?.text,
    ).toBe("Halgeir attacked GangHo — miss");
    expect(
      buildCombatLastAction({ gmEvents, logEvents: [declaration], participants, roundNumber: 1 })
        ?.text,
    ).toBe("GangHo rolled Initiative 5");
    // Phase 2 initiative follows the phase 1 entries.
    expect(
      buildCombatLastAction({
        gmEvents: [{ ...phase1Initiative, phase: "phase2" } as ProjectedCombatHistoryEvent],
        logEvents: [declaration, attack],
        participants,
        roundNumber: 1,
      })?.text,
    ).toBe("GangHo rolled Initiative 5");
  });

  it("never attributes an event to anyone but its actor and skips actorless events", () => {
    const actorless = logEvent("l-none", "ev-none", {
      summaryFacts: { actionLabel: "Parry", kind: "declaration_submitted" },
    });
    expect(
      buildCombatLastAction({
        gmEvents: [rawEvent("ev-none", 5)],
        logEvents: [actorless],
        participants,
        roundNumber: 1,
      }),
    ).toBeNull();
  });

  it("names the GM, not a combatant, for a bulk initiative commit and then yields to real actions", () => {
    const commit = {
      entries: [
        { initiativeResult: { total: 14 }, participantId: "p-halgeir" },
        { initiativeResult: { total: 9 }, participantId: "p-gangho" },
      ],
      phase: "phase1",
      roundNumber: 1,
    };
    const base = {
      committedInitiativeOrders: [commit],
      gmEvents: [],
      participants,
      roundNumber: 1,
    };
    expect(buildCombatLastAction({ ...base, logEvents: [declaration] })?.text).toBe(
      "GM committed initiative for all combatants (Halgeir 14, GangHo 9)",
    );
    expect(buildCombatLastAction({ ...base, logEvents: [declaration, attackMiss] })?.text).toBe(
      "Halgeir attacked GangHo — miss",
    );
    // No recorded totals: no invented order.
    expect(
      buildCombatLastAction({
        ...base,
        committedInitiativeOrders: [
          { ...commit, entries: [{ participantId: "p-halgeir" }, { participantId: "p-gangho" }] },
        ],
        logEvents: [declaration],
      })?.text,
    ).toBe("GM committed initiative for all combatants");
    // Individually rolled initiative: the commit only closes the rolls.
    expect(
      buildCombatLastAction({
        ...base,
        gmEvents: [
          rawEvent("ev-init", 4, {
            facts: { publicOutcome: { total: 14 } },
            ownerParticipantId: "p-halgeir",
            phase: "phase1",
            type: "initiative",
          }),
        ],
        logEvents: [declaration],
      })?.text,
    ).toBe("Halgeir rolled Initiative 14");
  });
});

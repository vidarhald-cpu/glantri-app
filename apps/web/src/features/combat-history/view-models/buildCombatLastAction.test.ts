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
  summaryFacts: { actionLabel: "Parry", kind: "declaration_submitted" },
});
const attackMiss = logEvent("l-atk", "ev-atk", {
  actor: { displayName: "Halgeir", participantId: "p-halgeir" },
  category: "attack",
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
});

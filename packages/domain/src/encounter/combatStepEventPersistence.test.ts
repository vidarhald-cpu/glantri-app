import { describe, expect, it } from "vitest";

import {
  appendCanonicalCombatStepEventForCommand,
  combatRoundCommandSchema,
  combatRoundStateSchema,
  completedCombatRoundSchema,
  removeCanonicalCombatStepEventsForCommand,
  type CombatRoundCommand,
} from "../index";

function command(id: string, createdAt: string): CombatRoundCommand {
  return combatRoundCommandSchema.parse({
    afterCursor: { participantId: "attacker", roundNumber: 1, step: "A1" },
    beforeCursor: { participantId: "attacker", roundNumber: 1, step: "A1" },
    createdAt,
    facts: {},
    id,
    participantId: "attacker",
    phase: "phase1",
    roundNumber: 1,
    step: "A1",
    type: "roll_attack",
  });
}

function appendAttack(events: Parameters<typeof appendCanonicalCombatStepEventForCommand>[0]["events"], inputCommand: CombatRoundCommand) {
  return appendCanonicalCombatStepEventForCommand({
    command: inputCommand,
    draft: {
      actorParticipantId: "attacker",
      attackResultId: "1:phase1:attacker:defender",
      attackerParticipantId: "attacker",
      defenderParticipantId: "defender",
      facts: {
        involvedOutcome: { tableResult: "Hit" },
        publicOutcome: { hit: true },
        rollerPrivate: { rollD20: 18, rollTotal: 18 },
      },
      ownerParticipantId: "attacker",
      phase: "phase1",
      rollerParticipantId: "attacker",
      sourceIds: ["1:phase1:attacker:defender"],
      status: "recorded",
      step: "phase_1_actions",
      targetParticipantId: "defender",
      type: "attack",
    },
    encounterId: "encounter-1",
    events,
  });
}

describe("persisted CombatStepEvents", () => {
  it("keeps legacy active and archived round states valid with empty event history", () => {
    const active = combatRoundStateSchema.parse({ roundNumber: 1 });
    const archived = completedCombatRoundSchema.parse({ roundNumber: 1 });

    expect(active.events).toEqual([]);
    expect(archived.events).toEqual([]);
  });

  it("assigns stable IDs and monotonic sequence without duplicating a canonical source", () => {
    const firstCommand = command("command-1", "2026-01-01T00:01:00.000Z");
    const secondCommand = command("command-2", "2026-01-01T00:02:00.000Z");
    const first = appendAttack([], firstCommand);
    const retry = appendAttack(first, firstCommand);
    const second = appendAttack(retry, secondCommand);
    const reloaded = combatRoundStateSchema.parse({
      encounterId: "encounter-1",
      events: JSON.parse(JSON.stringify(second)),
      roundNumber: 1,
    });

    expect(retry).toEqual(first);
    expect(second.map((event) => event.sequence)).toEqual([0, 1]);
    expect(second.map((event) => event.id)).toEqual([
      "combat-step-event:command-1:attack",
      "combat-step-event:command-2:attack",
    ]);
    expect(reloaded.events).toEqual(second);
    expect(reloaded.events[0]?.facts.publicOutcome).toEqual({ hit: true });
    expect(reloaded.events[0]?.facts.publicOutcome).not.toHaveProperty("rollD20");
    expect(reloaded.events[0]?.facts.rollerPrivate).toEqual({ rollD20: 18, rollTotal: 18 });
  });

  it("removes only events owned by the undone command", () => {
    const first = appendAttack([], command("command-1", "2026-01-01T00:01:00.000Z"));
    const second = appendAttack(
      first,
      command("command-2", "2026-01-01T00:02:00.000Z"),
    );
    const remaining = removeCanonicalCombatStepEventsForCommand({
      commandId: "command-2",
      events: second,
    });

    expect(remaining).toEqual(first);
    expect(remaining[0]?.sequence).toBe(0);
  });
});

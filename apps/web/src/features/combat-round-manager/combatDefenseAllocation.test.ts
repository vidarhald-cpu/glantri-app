import type { CombatDefenseSnapshot } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  applyCombatDefenseAllocationToStats,
  getCombatDefenseSelectionFromSnapshot,
  selectCombatDefenseCombinationRow,
  selectCombatDefenseSnapshotForAttackUnderResolution,
} from "./combatDefenseAllocation";

function snapshot(input: {
  attackId: string;
  attackerParticipantId: string;
  attackDirection: CombatDefenseSnapshot["attackDirection"];
  eventSequence: number;
  offHandIncluded?: boolean;
  mainHandIncluded?: boolean;
}): CombatDefenseSnapshot {
  const mainIncluded = input.mainHandIncluded ?? true;
  const offIncluded = input.offHandIncluded ?? true;
  return {
    attackDirection: input.attackDirection,
    attackerParticipantId: input.attackerParticipantId,
    attackId: input.attackId,
    attackOpportunityId: `${input.attackId}:opportunity`,
    aware: true,
    awarenessDefault: true,
    awarenessOverridden: false,
    defenderParticipantId: "defender",
    eventSequence: input.eventSequence,
    id: `defense-snapshot:${input.attackId}`,
    ordinaryDodgeAvailable: true,
    phase: "phase1",
    reviewedAt: "2026-11-08T10:00:00.000Z",
    roundNumber: 1,
    schemaVersion: 1,
    sources: [
      {
        decision: mainIncluded ? "default_included" : "gm_excluded",
        included: mainIncluded,
        itemId: "sword",
        itemRevision: "r1",
        kind: "weapon",
        label: "Short sword",
        slot: "mainHand",
        templateId: "t-sword",
      },
      {
        decision: offIncluded ? "default_included" : "gm_excluded",
        included: offIncluded,
        itemId: "shield",
        itemRevision: "r1",
        kind: "shield",
        label: "Medium shield",
        slot: "offHand",
        templateId: "t-shield",
      },
    ],
    status: "committed",
  };
}

const first = snapshot({
  attackDirection: "front",
  attackId: "attack-first",
  attackerParticipantId: "first",
  eventSequence: 3,
});
const second = snapshot({
  attackDirection: "left",
  attackId: "attack-second",
  attackerParticipantId: "second",
  eventSequence: 7,
  offHandIncluded: false,
});

const options = [
  {
    db: "5",
    dm: "2",
    id: "Short sword|0",
    label: "Short sword",
    parry: "11",
    sourceName: "Short sword",
  },
  {
    db: "9",
    dm: "4",
    id: "Medium shield|1",
    label: "Medium shield",
    parry: "14",
    sourceName: "Medium shield",
  },
  { db: "9", dm: "4", id: "Combined|2", label: "Combined", parry: "19", sourceName: "Combined" },
];

describe("GM defensive allocation per attack (#874)", () => {
  it("reads the snapshot of the attack under resolution, not the latest in the phase", () => {
    const read = (attackUnderResolutionId?: string, historical = false) =>
      selectCombatDefenseSnapshotForAttackUnderResolution({
        attackUnderResolutionId,
        defenderParticipantId: "defender",
        historical,
        phase: "phase1",
        roundNumber: 1,
        snapshots: [first, second],
      });

    expect(read("attack-first")?.attackDirection).toBe("front");
    expect(read("attack-second")?.attackDirection).toBe("left");
    // An attack whose review is not yet committed has no snapshot of its own.
    expect(read("attack-third")).toBeUndefined();
    // With no attack under resolution, live display falls back to the default.
    expect(read(undefined)).toBeUndefined();
    // Historical inspection with no exact attack keeps its previous reading.
    expect(read(undefined, true)?.attackId).toBe("attack-second");
  });

  it("refuses a snapshot recorded for another defender or phase", () => {
    expect(
      selectCombatDefenseSnapshotForAttackUnderResolution({
        attackUnderResolutionId: "attack-first",
        defenderParticipantId: "someone-else",
        historical: false,
        phase: "phase1",
        roundNumber: 1,
        snapshots: [first],
      }),
    ).toBeUndefined();
    expect(
      selectCombatDefenseSnapshotForAttackUnderResolution({
        attackUnderResolutionId: "attack-first",
        defenderParticipantId: "defender",
        historical: false,
        phase: "phase2",
        roundNumber: 1,
        snapshots: [first],
      }),
    ).toBeUndefined();
  });

  it("reads the hands a committed snapshot included", () => {
    expect(getCombatDefenseSelectionFromSnapshot(first)).toEqual({
      usedMainHand: true,
      usedOffHand: true,
    });
    expect(getCombatDefenseSelectionFromSnapshot(second)).toEqual({
      usedMainHand: true,
      usedOffHand: false,
    });
  });

  it("resolves weapon-only, shield-only and both to one derived row each", () => {
    const row = (usedMainHand: boolean, usedOffHand: boolean) =>
      selectCombatDefenseCombinationRow({
        mainHandLabel: "Short sword",
        offHandLabel: "Medium shield",
        options,
        selection: { usedMainHand, usedOffHand },
      })?.id;

    expect(row(true, true)).toBe("Combined|2");
    expect(row(true, false)).toBe("Short sword|0");
    expect(row(false, true)).toBe("Medium shield|1");
    expect(row(false, false)).toBeUndefined();
  });

  it("puts the row in force into the mini-table and keeps an incomplete parry incomplete", () => {
    const stats = { db: "9", dm: "4", parry: "19", sourceName: "Combined" };
    expect(applyCombatDefenseAllocationToStats(stats, options[0])).toEqual({
      db: "5",
      dm: "2",
      parry: "11",
      sourceName: "Short sword",
    });
    expect(
      applyCombatDefenseAllocationToStats({ ...stats, parry: "incomplete" }, options[1]),
    ).toMatchObject({ parry: "incomplete", sourceName: "Medium shield" });
    expect(applyCombatDefenseAllocationToStats(stats, undefined)).toBe(stats);
  });
});

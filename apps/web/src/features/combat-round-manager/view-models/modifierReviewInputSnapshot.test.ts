import { describe, expect, it } from "vitest";

import type { CurrentActionCommandDescriptor } from "@/features/combat-history";
import { createEmptyPlayerEncounterCombatContext } from "@/lib/campaigns/playerEncounter";

import { getOrCreateCombatModifierReviewInputSnapshot } from "./modifierReviewInputSnapshot";

function descriptor(
  overrides: Partial<CurrentActionCommandDescriptor> = {},
): CurrentActionCommandDescriptor {
  return {
    commandType: "review_modifiers_phase1",
    encounterId: "encounter-1",
    executionGroupId: "M1:1",
    expectedBoundary: "phase1_modifier_review",
    expectedRevision: "encounter-revision-1",
    participantId: "combatant-1",
    taskId: "M1:combatant-1",
    ...overrides,
  };
}

describe("modifier review input snapshots", () => {
  it("retains one participant revision across local edits and equivalent presentation rebuilds", () => {
    const snapshots = new Map();
    const original = getOrCreateCombatModifierReviewInputSnapshot({
      combatContext: createEmptyPlayerEncounterCombatContext(),
      descriptor: descriptor(),
      expectedParticipantRevision: "participant-revision-1",
      participantId: "participant-1",
      snapshots,
    });
    const rebuilt = getOrCreateCombatModifierReviewInputSnapshot({
      combatContext: {
        ...createEmptyPlayerEncounterCombatContext(),
        selectedOpponentId: "local-only-edit",
      },
      descriptor: descriptor(),
      expectedParticipantRevision: "participant-revision-2",
      participantId: "participant-1",
      snapshots,
    });

    expect(rebuilt).toBe(original);
    expect(rebuilt?.expectedParticipantRevision).toBe("participant-revision-1");
    expect(rebuilt?.combatContext.selectedOpponentId).toBeUndefined();
  });

  it("opens a new snapshot for a new canonical encounter revision", () => {
    const snapshots = new Map();
    const original = getOrCreateCombatModifierReviewInputSnapshot({
      combatContext: createEmptyPlayerEncounterCombatContext(),
      descriptor: descriptor(),
      expectedParticipantRevision: "participant-revision-1",
      participantId: "participant-1",
      snapshots,
    });
    const next = getOrCreateCombatModifierReviewInputSnapshot({
      combatContext: createEmptyPlayerEncounterCombatContext(),
      descriptor: descriptor({ expectedRevision: "encounter-revision-2" }),
      expectedParticipantRevision: "participant-revision-2",
      participantId: "participant-1",
      snapshots,
    });

    expect(next).not.toBe(original);
    expect(next?.expectedParticipantRevision).toBe("participant-revision-2");
  });
});

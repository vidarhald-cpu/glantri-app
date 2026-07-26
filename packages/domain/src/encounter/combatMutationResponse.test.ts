import { describe, expect, it } from "vitest";

import {
  activeCombatMutationResponseSchema,
  applyActiveCombatMutationResponse,
  buildActiveCombatMutationResponse,
  combatRoundStateSchema,
  encounterSessionSchema,
} from "../index";

function encounter(revision = "2026-07-26T12:00:00.000Z") {
  return encounterSessionSchema.parse({
    combatRoundState: combatRoundStateSchema.parse({
      encounterId: "encounter-1",
      participants: [{ label: "Aria", participantId: "aria" }],
      roundNumber: 3,
      rounds: [
        { encounterId: "encounter-1", roundNumber: 1 },
        { encounterId: "encounter-1", roundNumber: 2 },
      ],
    }),
    createdAt: "2026-07-26T09:00:00.000Z",
    currentRound: 3,
    id: "encounter-1",
    status: "active",
    title: "Courtyard",
    updatedAt: revision,
  });
}

describe("active combat mutation response", () => {
  it("contains active state without archived rounds or a full encounter", () => {
    const response = buildActiveCombatMutationResponse({ encounter: encounter() });
    const serialized = JSON.stringify(response);

    expect(response).toMatchObject({
      encounterId: "encounter-1",
      revision: "2026-07-26T12:00:00.000Z",
      version: 1,
    });
    expect("rounds" in response.activeCombatState).toBe(false);
    expect(serialized).not.toContain('"encounter":');
    expect(serialized).not.toContain('"archivedRounds":');
    expect(serialized.length).toBeLessThan(20_000);
  });

  it("keeps response size independent of archived-round history", () => {
    const current = encounter();
    const withoutHistory = buildActiveCombatMutationResponse({
      encounter: {
        ...current,
        combatRoundState: {
          ...current.combatRoundState!,
          rounds: [],
        },
      },
    });
    const withLargeHistory = buildActiveCombatMutationResponse({
      encounter: {
        ...current,
        combatRoundState: {
          ...current.combatRoundState!,
          rounds: Array.from({ length: 50 }, (_, index) => ({
            ...current.combatRoundState!.rounds[0]!,
            encounterId: current.id,
            participants: current.combatRoundState!.rounds[0]!.participants.map((participant) => ({
              ...participant,
              label: `Archived ${"x".repeat(10_000)}`,
            })),
            roundNumber: index + 1,
          })),
        },
      },
    });

    expect(JSON.stringify(withLargeHistory)).toBe(JSON.stringify(withoutHistory));
  });

  it("rejects history-bearing or full-encounter response fields", () => {
    const response = buildActiveCombatMutationResponse({ encounter: encounter() });

    expect(() =>
      activeCombatMutationResponseSchema.parse({
        ...response,
        archivedRounds: [],
      }),
    ).toThrow();
    expect(() =>
      activeCombatMutationResponseSchema.parse({
        ...response,
        encounter: encounter(),
      }),
    ).toThrow();
  });

  it("rejects a history-sized mutation-specific presentation payload", () => {
    expect(() =>
      buildActiveCombatMutationResponse({
        encounter: encounter(),
        mutationPresentation: {
          result: "x".repeat(70 * 1024),
        },
      }),
    ).toThrow("remain compact");
  });

  it("replaces active state and revision while retaining separately loaded history", () => {
    const current = encounter();
    const nextFull = encounter("2026-07-26T12:01:00.000Z");
    nextFull.combatRoundState!.currentStep = "initiative_phase_1";
    const response = buildActiveCombatMutationResponse({ encounter: nextFull });

    const applied = applyActiveCombatMutationResponse({
      currentEncounter: current,
      response,
    });

    expect(applied.updatedAt).toBe("2026-07-26T12:01:00.000Z");
    expect(applied.combatRoundState?.currentStep).toBe("initiative_phase_1");
    expect(applied.combatRoundState?.rounds).toEqual(current.combatRoundState?.rounds);
  });

  it("fails closed when a response is applied to another encounter", () => {
    const response = buildActiveCombatMutationResponse({ encounter: encounter() });
    const other = encounterSessionSchema.parse({
      ...encounter(),
      id: "encounter-2",
    });

    expect(() =>
      applyActiveCombatMutationResponse({
        currentEncounter: other,
        response,
      }),
    ).toThrow("different encounter");
  });
});

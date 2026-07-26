import { combatRoundStateSchema, encounterSessionSchema } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  buildRequestedCombatMutationResponse,
  prefersActiveCombatMutationResponse,
} from "./combatMutationResponse";

function encounter() {
  return encounterSessionSchema.parse({
    combatRoundState: combatRoundStateSchema.parse({
      commands: [
        {
          afterCursor: { roundNumber: 1, step: "A1" },
          beforeCursor: { roundNumber: 1, step: "i1" },
          createdAt: "2026-07-26T12:00:00.000Z",
          facts: {},
          id: "command-1",
          participantId: "aria",
          roundNumber: 1,
          type: "commit_phase_initiative_resolution",
        },
      ],
      encounterId: "encounter-1",
      participants: [{ label: "Aria", participantId: "aria" }],
      rounds: Array.from({ length: 20 }, (_, index) => ({
        commands: [],
        encounterId: "encounter-1",
        participants: Array.from({ length: 5 }, (_, participantIndex) => ({
          label: `Archived participant ${participantIndex + 1} in round ${index + 1}`,
          participantId: `round-${index + 1}-participant-${participantIndex + 1}`,
        })),
        roundNumber: index + 1,
      })),
    }),
    createdAt: "2026-07-26T09:00:00.000Z",
    id: "encounter-1",
    status: "active",
    title: "Courtyard",
    updatedAt: "2026-07-26T12:00:00.000Z",
  });
}

describe("combat mutation response negotiation", () => {
  it("keeps the legacy response available when active-v1 is not requested", () => {
    const payload = { encounter: encounter(), initiative: { total: 7 } };

    expect(
      buildRequestedCombatMutationResponse({
        activeResponseRequested: false,
        payload,
      }),
    ).toBe(payload);
  });

  it("returns active state and compact presentation without the full encounter or command copy", () => {
    const response = buildRequestedCombatMutationResponse({
      activeResponseRequested: true,
      payload: {
        command: encounter().combatRoundState?.commands[0],
        encounter: encounter(),
        initiative: { total: 7 },
      },
    }) as Record<string, unknown>;
    const serialized = JSON.stringify(response);

    expect(response).toMatchObject({
      encounterId: "encounter-1",
      mutationPresentation: { initiative: { total: 7 } },
      version: 1,
    });
    expect(response).not.toHaveProperty("encounter");
    expect(response).not.toHaveProperty("command");
    expect((response.activeCombatState as Record<string, unknown>).rounds).toBeUndefined();
    expect(serialized.length).toBeLessThan(JSON.stringify({ encounter: encounter() }).length);
  });

  it("recognizes only the versioned active response header", () => {
    expect(prefersActiveCombatMutationResponse("active-v1")).toBe(true);
    expect(prefersActiveCombatMutationResponse(["active-v1"])).toBe(true);
    expect(prefersActiveCombatMutationResponse("legacy")).toBe(false);
  });
});

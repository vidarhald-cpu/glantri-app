import { describe, expect, it } from "vitest";

import { defaultCombatAllocationState } from "./combatAllocationState";
import {
  createCombatSession,
  getActorAllocation,
  updateActorAllocation
} from "./combatSessionState";

describe("combatSessionState", () => {
  it("creates a minimal combat session with normalized actors", () => {
    const session = createCombatSession([
      {
        actorId: "actor-1",
        characterId: "char-1",
        allocation: defaultCombatAllocationState
      }
    ]);

    expect(session.sessionId).toContain("combat-session-");
    expect(session.round).toBe(1);
    expect(session.phase).toBe("setup");
    expect(session.activeActorId).toBe("actor-1");
    expect(session.actors).toHaveLength(1);
    expect(session.actors[0]).toEqual({
      actorId: "actor-1",
      characterId: "char-1",
      allocation: defaultCombatAllocationState
    });
  });

  it("updates a single actor allocation immutably", () => {
    const session = createCombatSession([
      {
        actorId: "actor-1",
        characterId: "char-1",
        allocation: defaultCombatAllocationState
      },
      {
        actorId: "actor-2",
        characterId: "char-2",
        allocation: defaultCombatAllocationState
      }
    ]);

    const updated = updateActorAllocation(session, "actor-2", {
      ...defaultCombatAllocationState,
      defensePosture: "parry",
      parry: {
        allocatedOb: 15,
        source: "primary"
      }
    });

    expect(updated).not.toBe(session);
    expect(getActorAllocation(updated, "actor-1")).toEqual(defaultCombatAllocationState);
    expect(getActorAllocation(updated, "actor-2")).toEqual({
      ...defaultCombatAllocationState,
      defensePosture: "parry",
      parry: {
        allocatedOb: 15,
        source: "primary"
      }
    });
    expect(getActorAllocation(session, "actor-2")).toEqual(defaultCombatAllocationState);
  });

  it("returns null for a missing actor allocation", () => {
    const session = createCombatSession([]);

    expect(getActorAllocation(session, "missing")).toBeNull();
  });
});

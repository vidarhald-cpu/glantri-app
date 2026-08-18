import { describe, expect, it } from "vitest";

import { punchTemplate } from "@glantri/content";
import type { ScenarioParticipant } from "@glantri/domain";

import { resolveCanonicalCombatInitiativeBase } from "./combatInitiativeResolution";

describe("canonical server initiative base", () => {
  it("fails closed when canonical build or declared weapon facts are missing", () => {
    const participant = {
      createdAt: "2026-08-07T10:00:00.000Z",
      id: "participant-1",
      isActive: true,
      joinSource: "gm_added",
      role: "npc",
      scenarioId: "scenario-1",
      snapshot: { displayName: "NPC" },
      sourceType: "entity",
      state: {
        combat: {},
        conditions: [],
        equipment: {},
        health: {},
        modifiers: [],
        resources: {},
      },
      updatedAt: "2026-08-07T10:00:00.000Z",
    } as unknown as ScenarioParticipant;

    expect(resolveCanonicalCombatInitiativeBase({ participant })).toMatchObject({
      completeness: "partial",
    });
  });

  it("uses the declared canonical weapon template rather than a client initiative value", () => {
    const participant = {
      characterId: "character-1",
      createdAt: "2026-08-07T10:00:00.000Z",
      id: "participant-1",
      isActive: true,
      joinSource: "gm_added",
      role: "npc",
      scenarioId: "scenario-1",
      snapshot: {
        build: {
          equipment: { items: [] },
          id: "character-1",
          name: "NPC",
          profile: {
            distractionLevel: 3,
            id: "profile-1",
            label: "NPC",
            rolledStats: {
              cha: 10,
              com: 10,
              con: 10,
              dex: 16,
              health: 10,
              int: 10,
              lck: 10,
              pow: 10,
              siz: 10,
              str: 10,
              will: 10,
            },
            societyLevel: 0,
          },
          progression: {
            chargenMode: "standard",
            educationPoints: 0,
            flexiblePointFactor: 1,
            level: 1,
            primaryPoolSpent: 0,
            primaryPoolTotal: 60,
            secondaryPoolSpent: 6,
            secondaryPoolTotal: 20,
            skillGroups: [],
            skills: [
              {
                category: "secondary",
                categoryId: "combat",
                groupId: "basic_melee_training",
                secondaryRanks: 6,
                skillId: "brawling",
              },
            ],
            specializations: [],
          },
          progressionState: {
            availablePoints: 0,
            checks: [],
            history: [],
            pendingAttempts: [],
          },
          statModifiers: {},
        },
        displayName: "NPC",
      },
      sourceType: "character",
      state: {
        combat: {},
        conditions: [],
        equipment: {},
        health: {},
        modifiers: [],
        resources: {},
      },
      updatedAt: "2026-08-07T10:00:00.000Z",
    } as unknown as ScenarioParticipant;
    const result = resolveCanonicalCombatInitiativeBase({
      opportunity: {
        attackModeId: punchTemplate.attackModes![0]!.id,
        id: "opportunity-1",
        origin: "declared",
        phase: "phase1",
        slot: "attack_1",
        sourceKind: "unarmed",
        status: "committed",
        weaponSourceSlot: "virtual",
        weaponTemplateId: punchTemplate.id,
      },
      participant,
    });

    expect(result.completeness).toBe("complete");
    if (result.completeness === "complete")
      expect(result.initiativeBase).toEqual(expect.any(Number));
  });
});

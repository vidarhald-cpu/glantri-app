import type { EncounterSession, ScenarioParticipant } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { buildPlayerGeneralEncounterView } from "./playerGeneralEncounter";

function makeScenarioParticipant(input: {
  controlledByUserId?: string;
  id: string;
  name: string;
}): ScenarioParticipant {
  return {
    characterId: input.id,
    controlledByUserId: input.controlledByUserId,
    id: input.id,
    isActive: true,
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: {
      build: {},
      displayName: input.name,
      sheetSummary: {},
    },
    sourceType: "character",
    state: {},
  } as ScenarioParticipant;
}

function makeEncounter(): EncounterSession {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "encounter-1",
    kind: "roleplay",
    participants: [
      {
        id: "scenario-pc-1",
        label: "Player hero",
        participantType: "scenario",
        scenarioParticipantId: "pc-1",
      },
      {
        id: "scenario-npc-visible",
        label: "Visible NPC",
        participantType: "scenario",
        scenarioParticipantId: "npc-visible",
      },
      {
        id: "scenario-npc-hidden",
        label: "Hidden spy",
        participantType: "scenario",
        scenarioParticipantId: "npc-hidden",
      },
    ],
    roleplayState: {
      actionLog: [
        {
          createdAt: "2026-01-01T00:04:00.000Z",
          dieResult: 14,
          id: "visible-result",
          mode: "difficulty",
          numericSubtotal: 30,
          openEndedD10s: [],
          participantId: "scenario-pc-1",
          rollD20: 14,
          rollSetId: "roll-set-visible",
          silent: false,
          skillLabel: "Perception",
          skillId: "perception",
          summary: "GM rolled Perception.",
          type: "gm_skill_roll",
        },
        {
          createdAt: "2026-01-01T00:00:30.000Z",
          id: "historical-visible-result",
          mode: "difficulty",
          numericSubtotal: 50,
          participantId: "scenario-pc-1",
          silent: false,
          skillLabel: "Spot hidden",
          summary: "GM rolled Spot hidden.",
          type: "gm_skill_roll",
        },
        {
          createdAt: "2026-01-01T00:03:00.000Z",
          id: "hidden-result",
          mode: "difficulty",
          numericSubtotal: 40,
          participantId: "scenario-npc-hidden",
          silent: false,
          skillLabel: "Sneaking",
          summary: "GM rolled Sneaking.",
          type: "gm_skill_roll",
        },
        {
          createdAt: "2026-01-01T00:02:00.000Z",
          id: "silent-result",
          mode: "difficulty",
          numericSubtotal: 35,
          participantId: "scenario-pc-1",
          silent: true,
          skillLabel: "Listen",
          summary: "GM rolled Listen.",
          type: "gm_skill_roll",
        },
        {
          createdAt: "2026-01-01T00:01:30.000Z",
          id: "other-participant-result",
          mode: "difficulty",
          numericSubtotal: 18,
          participantId: "scenario-npc-visible",
          silent: false,
          skillLabel: "Haggle",
          summary: "GM rolled Haggle.",
          type: "gm_skill_roll",
        },
        {
          createdAt: "2026-01-01T00:01:00.000Z",
          id: "opposed-result",
          mode: "opposed",
          numericSubtotal: 25,
          participantId: "scenario-pc-1",
          silent: false,
          skillLabel: "Hide",
          summary: "GM rolled opposed Hide.",
          type: "gm_skill_roll",
        },
      ],
      gmMessage: "The market is loud and tense.",
      participantDescriptions: {
        "scenario-pc-1": {
          detailedDescription: "GM-only player note.",
          name: "Player hero",
          shortDescription: "Self",
        },
        "scenario-npc-hidden": {
          detailedDescription: "GM-only secret identity.",
          name: "Disguised spy",
          shortDescription: "A quiet figure",
        },
        "scenario-npc-visible": {
          detailedDescription: "GM-only motive.",
          name: "Street merchant",
          shortDescription: "A nervous seller",
        },
      },
      pendingSkillRolls: [
        {
          assignedAt: "2026-01-01T00:00:00.000Z",
          difficulty: "easy",
          id: "older-visible-roll",
          mode: "difficulty",
          participantId: "scenario-pc-1",
          rollSetId: "roll-set-old",
          silent: false,
          skillId: "listen",
          skillLabel: "Listen",
        },
        {
          assignedAt: "2026-01-01T00:05:00.000Z",
          difficulty: "medium",
          id: "visible-roll",
          mode: "difficulty",
          participantId: "scenario-pc-1",
          rollSetId: "roll-set-visible",
          silent: false,
          skillId: "perception",
          skillLabel: "Perception",
          skillValue: 16,
        },
        {
          assignedAt: "2026-01-01T00:00:00.000Z",
          id: "silent-roll",
          mode: "difficulty",
          participantId: "scenario-pc-1",
          silent: true,
          skillId: "hide",
          skillLabel: "Hide",
        },
      ],
      visibility: {
        "scenario-pc-1": {
          "scenario-npc-visible": true,
        },
      },
    },
    scenarioId: "scenario-1",
    status: "active",
    title: "Market Watch",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as EncounterSession;
}

describe("playerGeneralEncounter", () => {
  it("shows only participants visible to the current player and strips GM-only descriptions", () => {
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter: makeEncounter(),
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
        makeScenarioParticipant({ id: "npc-visible", name: "Visible NPC" }),
        makeScenarioParticipant({ id: "npc-hidden", name: "Hidden spy" }),
      ],
    });

    expect(view.gmMessage).toBe("The market is loud and tense.");
    expect(view.controlledParticipantIds).toEqual(["scenario-pc-1"]);
    expect(view.visibleParticipantIds).toEqual(["scenario-pc-1", "scenario-npc-visible"]);
    expect(view.visibleParticipants.map((participant) => participant.name)).toEqual(["Street merchant"]);
    expect(view.visibleParticipants.map((participant) => participant.name)).not.toContain("Disguised spy");
    expect(view.visibleParticipants.map((participant) => participant.name)).not.toContain("Player hero");
    expect(view.visibleParticipants.map((participant) => participant.shortDescription)).toContain(
      "A nervous seller"
    );
    expect(JSON.stringify(view.visibleParticipants)).not.toContain("GM-only");
  });

  it("shows assigned non-silent rolls and hides silent roll requests", () => {
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter: makeEncounter(),
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
      ],
    });

    expect(view.assignedRolls).toHaveLength(1);
    expect(view.assignedRolls.map((roll) => roll.id)).not.toContain("older-visible-roll");
    expect(view.assignedRolls[0]).toMatchObject({
      difficultyLabel: "Medium",
      result: {
        dieResult: 14,
        id: "visible-result",
        total: 30,
      },
      rollSetId: "roll-set-visible",
      skillLabel: "Perception",
      skillValue: 16,
    });
    expect(JSON.stringify(view.assignedRolls)).not.toContain("silent-roll");
  });

  it("keeps ranked results player-safe by hiding hidden, silent, opposed, and historical rolls", () => {
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter: makeEncounter(),
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
        makeScenarioParticipant({ id: "npc-visible", name: "Visible NPC" }),
        makeScenarioParticipant({ id: "npc-hidden", name: "Hidden spy" }),
      ],
    });

    expect(view.rankedResults).toEqual([
      {
        id: "visible-result",
        participantName: "Player hero",
        skillLabel: "Perception",
        total: 30,
      },
    ]);
    expect(JSON.stringify(view.rankedResults)).not.toContain("historical-visible-result");
  });

  it("shows a conservative character log for the controlled participant only", () => {
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter: makeEncounter(),
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
        makeScenarioParticipant({ id: "npc-visible", name: "Visible NPC" }),
      ],
    });

    expect(view.characterLog).toEqual([
      {
        id: "visible-result",
        skillLabel: "Perception",
        timestamp: "2026-01-01T00:04:00.000Z",
        total: 30,
      },
      {
        id: "opposed-result",
        skillLabel: "Hide",
        timestamp: "2026-01-01T00:01:00.000Z",
        total: 25,
      },
      {
        id: "historical-visible-result",
        skillLabel: "Spot hidden",
        timestamp: "2026-01-01T00:00:30.000Z",
        total: 50,
      },
    ]);
    expect(JSON.stringify(view.characterLog)).not.toContain("silent-result");
    expect(JSON.stringify(view.characterLog)).not.toContain("other-participant-result");
  });
});

import type {
  EncounterSession,
  RoleplayActionLogEntry,
  RoleplayPendingSkillRoll,
  ScenarioParticipant,
} from "@glantri/domain";
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

function makeRoleplayActionLogEntry(
  input: Partial<RoleplayActionLogEntry> & Pick<RoleplayActionLogEntry, "id" | "summary">
): RoleplayActionLogEntry {
  const { id, summary, ...rest } = input;
  return {
    autoSuccess: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    fumble: false,
    id,
    mode: "difficulty",
    openEndedD10s: [],
    opponentFumble: false,
    opponentOpenEndedD10s: [],
    opponentSilent: false,
    partial: false,
    silent: false,
    summary,
    supportOpenEndedD10s: [],
    type: "gm_skill_roll",
    ...rest,
  };
}

function makePendingSkillRoll(
  input: Partial<RoleplayPendingSkillRoll> &
    Pick<RoleplayPendingSkillRoll, "id" | "participantId" | "skillId" | "skillLabel">
): RoleplayPendingSkillRoll {
  const { id, participantId, skillId, skillLabel, ...rest } = input;
  return {
    assignedAt: "2026-01-01T00:00:00.000Z",
    id,
    mode: "difficulty",
    opponentSilent: false,
    otherMod: 0,
    participantId,
    silent: false,
    skillId,
    skillLabel,
    useDbMod: false,
    useGenMod: false,
    useObSkillMod: false,
    ...rest,
  };
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
        makeRoleplayActionLogEntry({
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
        }),
        makeRoleplayActionLogEntry({
          createdAt: "2026-01-01T00:00:30.000Z",
          id: "historical-visible-result",
          mode: "difficulty",
          numericSubtotal: 50,
          participantId: "scenario-pc-1",
          silent: false,
          skillLabel: "Spot hidden",
          summary: "GM rolled Spot hidden.",
          type: "gm_skill_roll",
        }),
        makeRoleplayActionLogEntry({
          createdAt: "2026-01-01T00:03:00.000Z",
          id: "hidden-result",
          mode: "difficulty",
          numericSubtotal: 40,
          participantId: "scenario-npc-hidden",
          silent: false,
          skillLabel: "Sneaking",
          summary: "GM rolled Sneaking.",
          type: "gm_skill_roll",
        }),
        makeRoleplayActionLogEntry({
          createdAt: "2026-01-01T00:02:00.000Z",
          id: "silent-result",
          mode: "difficulty",
          numericSubtotal: 35,
          participantId: "scenario-pc-1",
          silent: true,
          skillLabel: "Listen",
          summary: "GM rolled Listen.",
          type: "gm_skill_roll",
        }),
        makeRoleplayActionLogEntry({
          createdAt: "2026-01-01T00:01:30.000Z",
          id: "other-participant-result",
          mode: "difficulty",
          numericSubtotal: 18,
          participantId: "scenario-npc-visible",
          silent: false,
          skillLabel: "Haggle",
          summary: "GM rolled Haggle.",
          type: "gm_skill_roll",
        }),
        makeRoleplayActionLogEntry({
          createdAt: "2026-01-01T00:01:00.000Z",
          id: "opposed-result",
          mode: "opposed",
          numericSubtotal: 25,
          participantId: "scenario-pc-1",
          silent: false,
          skillLabel: "Hide",
          summary: "GM rolled opposed Hide.",
          type: "gm_skill_roll",
        }),
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
        makePendingSkillRoll({
          assignedAt: "2026-01-01T00:00:00.000Z",
          difficulty: "easy",
          id: "older-visible-roll",
          mode: "difficulty",
          participantId: "scenario-pc-1",
          rollSetId: "roll-set-old",
          silent: false,
          skillId: "listen",
          skillLabel: "Listen",
        }),
        makePendingSkillRoll({
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
        }),
        makePendingSkillRoll({
          assignedAt: "2026-01-01T00:00:00.000Z",
          id: "silent-roll",
          mode: "difficulty",
          participantId: "scenario-pc-1",
          silent: true,
          skillId: "hide",
          skillLabel: "Hide",
        }),
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
  } as unknown as EncounterSession;
}

function makeEmptyParticipantEncounter(): EncounterSession {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "encounter-empty",
    kind: "roleplay",
    participants: [],
    roleplayState: {
      actionLog: [],
      gmMessage: "The doors open.",
      participantDescriptions: {},
      pendingSkillRolls: [],
      visibility: {},
    },
    scenarioId: "scenario-1",
    status: "active",
    title: "Open scene",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as EncounterSession;
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

  it("matches assigned rolls by scenario participant id when needed", () => {
    const baseEncounter = makeEncounter();
    const encounter = {
      ...baseEncounter,
      roleplayState: {
        ...baseEncounter.roleplayState,
        pendingSkillRolls: [
          makePendingSkillRoll({
            assignedAt: "2026-01-01T00:06:00.000Z",
            difficulty: "medium",
            id: "scenario-participant-roll",
            mode: "difficulty",
            participantId: "pc-1",
            rollSetId: "roll-set-scenario-participant",
            silent: false,
            skillId: "first-aid",
            skillLabel: "First aid",
            skillValue: 23,
          }),
        ],
      },
    } as EncounterSession;
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter,
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
      ],
    });

    expect(view.assignedRolls).toHaveLength(1);
    expect(view.assignedRolls[0]).toMatchObject({
      id: "scenario-participant-roll",
      participantId: "scenario-pc-1",
      participantName: "Player hero",
      skillLabel: "First aid",
      skillValue: 23,
    });
  });

  it("shows a player-submitted result for an assigned opposed actor roll", () => {
    const baseEncounter = makeEncounter();
    const encounter = {
      ...baseEncounter,
      roleplayState: {
        ...baseEncounter.roleplayState,
        actionLog: [
          makeRoleplayActionLogEntry({
            createdAt: "2026-01-01T00:07:00.000Z",
            dieResult: 26,
            id: "player-opposed-result",
            mode: "opposed",
            numericSubtotal: 50,
            openEndedD10s: [6],
            participantId: "scenario-pc-1",
            pendingRollId: "opposed-roll",
            rollD20: 20,
            rollSetId: "opposed-set",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            summary: "Player rolled Dodge.",
            type: "gm_skill_roll",
          }),
          makeRoleplayActionLogEntry({
            createdAt: "2026-01-01T00:06:30.000Z",
            dieResult: 23,
            id: "opponent-opposed-result",
            mode: "opposed",
            numericSubtotal: 41,
            openEndedD10s: [3],
            participantId: "scenario-npc-visible",
            rollD20: 20,
            rollSetId: "opposed-set",
            side: "opponent",
            silent: false,
            skillId: "brawling",
            skillLabel: "Brawling",
            summary: "GM rolled Brawling.",
            type: "gm_skill_roll",
          }),
          ...(baseEncounter.roleplayState?.actionLog ?? []),
        ],
        pendingSkillRolls: [
          makePendingSkillRoll({
            assignedAt: "2026-01-01T00:06:00.000Z",
            id: "opposed-roll",
            mode: "opposed",
            opponentParticipantId: "scenario-npc-visible",
            opponentSkillId: "brawling",
            opponentSkillLabel: "Brawling",
            participantId: "scenario-pc-1",
            rollSetId: "opposed-set",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            skillValue: 24,
          }),
        ],
      },
    } as EncounterSession;
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter,
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
        makeScenarioParticipant({ id: "npc-visible", name: "Visible NPC" }),
      ],
    });

    expect(view.assignedRolls).toHaveLength(1);
    expect(view.assignedRolls[0]).toMatchObject({
      id: "opposed-roll",
      mode: "opposed",
      comparison: "Player hero wins by 9.",
      result: {
        dieResult: 26,
        id: "player-opposed-result",
        total: 50,
      },
      rollSetId: "opposed-set",
      skillLabel: "Dodge",
    });
    expect(view.rankedResults.map((entry) => entry.id)).not.toContain("player-opposed-result");
  });

  it("does not reveal hidden opposed opponent comparison details", () => {
    const baseEncounter = makeEncounter();
    const encounter = {
      ...baseEncounter,
      roleplayState: {
        ...baseEncounter.roleplayState,
        actionLog: [
          makeRoleplayActionLogEntry({
            createdAt: "2026-01-01T00:07:00.000Z",
            dieResult: 12,
            id: "player-opposed-result",
            mode: "opposed",
            numericSubtotal: 36,
            openEndedD10s: [],
            participantId: "scenario-pc-1",
            pendingRollId: "opposed-roll",
            rollD20: 12,
            rollSetId: "hidden-opposed-set",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            summary: "Player rolled Dodge.",
            type: "gm_skill_roll",
          }),
          makeRoleplayActionLogEntry({
            createdAt: "2026-01-01T00:06:30.000Z",
            dieResult: 18,
            id: "hidden-opponent-opposed-result",
            mode: "opposed",
            numericSubtotal: 42,
            openEndedD10s: [],
            participantId: "scenario-npc-hidden",
            rollD20: 18,
            rollSetId: "hidden-opposed-set",
            side: "opponent",
            silent: false,
            skillId: "brawling",
            skillLabel: "Brawling",
            summary: "GM rolled Brawling.",
            type: "gm_skill_roll",
          }),
        ],
        pendingSkillRolls: [
          makePendingSkillRoll({
            assignedAt: "2026-01-01T00:06:00.000Z",
            id: "opposed-roll",
            mode: "opposed",
            opponentParticipantId: "scenario-npc-hidden",
            opponentSkillId: "brawling",
            opponentSkillLabel: "Brawling",
            participantId: "scenario-pc-1",
            rollSetId: "hidden-opposed-set",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            skillValue: 24,
          }),
        ],
      },
    } as EncounterSession;
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter,
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
        makeScenarioParticipant({ id: "npc-hidden", name: "Hidden spy" }),
      ],
    });

    expect(view.assignedRolls[0]?.comparison).toBeUndefined();
    expect(JSON.stringify(view.assignedRolls)).not.toContain("Hidden spy");
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

  it("excludes legacy side-specific opposed entries from ranked results by roll set", () => {
    const encounter = makeEncounter();

    encounter.roleplayState = {
      gmMessage: encounter.roleplayState?.gmMessage ?? "",
      participantDescriptions: encounter.roleplayState?.participantDescriptions ?? {},
      visibility: encounter.roleplayState?.visibility ?? {},
      actionLog: [
        makeRoleplayActionLogEntry({
          createdAt: "2026-01-01T00:08:00.000Z",
          id: "legacy-opposed-side-result",
          mode: "difficulty",
          numericSubtotal: 44,
          participantId: "scenario-pc-1",
          rollSetId: "opposed-set",
          side: "actor",
          silent: false,
          skillId: "administration",
          skillLabel: "Administration",
          summary: "GM rolled Administration.",
          type: "gm_skill_roll",
        }),
        ...(encounter.roleplayState?.actionLog ?? []),
      ],
      pendingSkillRolls: [
        makePendingSkillRoll({
          assignedAt: "2026-01-01T00:07:00.000Z",
          id: "opposed-pending",
          mode: "opposed",
          participantId: "scenario-pc-1",
          rollSetId: "opposed-set",
          side: "actor",
          silent: false,
          skillId: "administration",
          skillLabel: "Administration",
        }),
        ...(encounter.roleplayState?.pendingSkillRolls ?? []),
      ],
    };

    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter,
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
        makeScenarioParticipant({ id: "npc-visible", name: "Visible NPC" }),
      ],
    });

    expect(view.rankedResults.map((entry) => entry.id)).not.toContain("legacy-opposed-side-result");
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
        detail: "Perception · mod +0 · roll 14 · total 30",
        id: "visible-result",
        skillLabel: "Perception",
        timestamp: "2026-01-01T00:04:00.000Z",
        total: 30,
      },
      {
        detail: "Hide · mod +0 · total 25",
        id: "opposed-result",
        skillLabel: "Hide",
        timestamp: "2026-01-01T00:01:00.000Z",
        total: 25,
      },
      {
        detail: "Spot hidden · mod +0 · total 50",
        id: "historical-visible-result",
        skillLabel: "Spot hidden",
        timestamp: "2026-01-01T00:00:30.000Z",
        total: 50,
      },
    ]);
    expect(JSON.stringify(view.characterLog)).not.toContain("silent-result");
    expect(JSON.stringify(view.characterLog)).not.toContain("other-participant-result");
  });

  it("uses active scenario participants as fallback encounter participants when membership is empty", () => {
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter: makeEmptyParticipantEncounter(),
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
        makeScenarioParticipant({ id: "npc-visible", name: "Visible NPC" }),
      ],
    });

    expect(view.controlledParticipantIds).toEqual(["scenario-fallback-pc-1"]);
    expect(view.visibleParticipantIds).toEqual(["scenario-fallback-pc-1", "scenario-fallback-npc-visible"]);
    expect(view.visibleParticipants.map((participant) => participant.name)).toEqual(["Visible NPC"]);
  });

  it("does not fall back to scenario participants after explicit encounter membership exists", () => {
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter: makeEncounter(),
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "not-in-encounter", name: "Player hero" }),
        makeScenarioParticipant({ id: "npc-visible", name: "Visible NPC" }),
      ],
    });

    expect(view.controlledParticipantIds).toEqual([]);
    expect(view.visibleParticipants).toEqual([]);
    expect(view.assignedRolls).toEqual([]);
  });

  it("does not fall back when explicit membership is empty", () => {
    const view = buildPlayerGeneralEncounterView({
      currentUserId: "player-1",
      encounter: {
        ...makeEmptyParticipantEncounter(),
        participantMembershipMode: "explicit",
      },
      scenarioParticipants: [
        makeScenarioParticipant({ controlledByUserId: "player-1", id: "pc-1", name: "Player hero" }),
        makeScenarioParticipant({ id: "npc-visible", name: "Visible NPC" }),
      ],
    });

    expect(view.controlledParticipantIds).toEqual([]);
    expect(view.visibleParticipantIds).toEqual([]);
    expect(view.visibleParticipants).toEqual([]);
  });
});

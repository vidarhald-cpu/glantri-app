import { describe, expect, it } from "vitest";

import type { EncounterSession } from "./session";
import {
  buildRoleplayCalculationPreview,
  compareRoleplayOpposedRolls,
  getSkillRollSuccessLevel,
  getStatRollSuccessLevel,
  getRoleplayRequiredLowerThreshold,
  normalizeRoleplayOtherMod,
  normalizeRoleplayState,
  normalizeRollModifiers,
  orderRoleplayEncounterParticipants,
  rankRoleplayGmRollResults,
  roleplayDifficultyOptions,
} from "./roleplay";

function createSession(overrides: Partial<EncounterSession> = {}): EncounterSession {
  return {
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "roleplay",
    participants: [],
    status: "planned",
    title: "Market shadows",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("roleplay domain pure functions", () => {
  it("normalizes old encounters without roleplay state", () => {
    expect(normalizeRoleplayState(createSession())).toEqual({
      actionLog: [],
      gmMessage: "",
      participantDescriptions: {},
      pendingSkillRolls: [],
      visibility: {},
    });
  });

  it("normalizes stored no-level difficulty as no required difficulty", () => {
    const state = normalizeRoleplayState(
      createSession({
        roleplayState: {
          actionLog: [],
          gmMessage: "",
          participantDescriptions: {},
          pendingSkillRolls: [
            {
              assignedAt: "2026-01-01T00:00:00.000Z",
              difficulty: "none",
              id: "roll-1",
              participantId: "participant-1",
              silent: false,
              skillId: "perception",
              skillLabel: "Perception",
            },
          ],
          visibility: {},
        } as never,
      })
    );

    expect(state.pendingSkillRolls[0]?.difficulty).toBeUndefined();
    expect(state.pendingSkillRolls[0]?.opponentSilent).toBe(false);
  });

  it("uses the roleplay success table difficulty labels", () => {
    expect(roleplayDifficultyOptions.map((option) => option.label)).toEqual([
      "Trivial success",
      "Easy",
      "Medium -",
      "Medium",
      "Medium +",
      "Hard",
      "Very hard",
      "Critical",
      "Legendary",
      "Godly",
    ]);
  });

  it("normalizes roll modifiers with defaults", () => {
    const result = normalizeRollModifiers(undefined);
    expect(result).toEqual({ otherMod: 0, useDbMod: false, useGenMod: false, useObSkillMod: false });

    const withValues = normalizeRollModifiers({ otherMod: -3, useDbMod: true });
    expect(withValues).toEqual({ otherMod: -3, useDbMod: true, useGenMod: false, useObSkillMod: false });
  });

  it("normalizes other mods", () => {
    expect(normalizeRoleplayOtherMod("")).toBe(0);
    expect(normalizeRoleplayOtherMod("-2")).toBe(-2);
    expect(normalizeRoleplayOtherMod(3.8)).toBe(3);
    expect(normalizeRoleplayOtherMod("bogus")).toBe(0);
  });

  it("returns required threshold by difficulty and kind", () => {
    expect(getRoleplayRequiredLowerThreshold("medium", "skill")).toBe(26);
    expect(getRoleplayRequiredLowerThreshold("medium", "stat")).toBe(21);
    expect(getRoleplayRequiredLowerThreshold("hard")).toBe(36);
  });

  it.each([
    [10, "fumble"],
    [11, "trivial_success"],
    [16, "easy"],
    [21, "medium_minus"],
    [26, "medium"],
    [31, "medium_plus"],
    [36, "hard"],
    [41, "very_hard"],
    [46, "critical"],
    [51, "legendary"],
    [56, "godly"],
  ])("maps skill total %i to %s", (total, expectedId) => {
    expect(getSkillRollSuccessLevel(total).id).toBe(expectedId);
  });

  it.each([
    [5, "fumble"],
    [6, "trivial_success"],
    [11, "easy"],
    [16, "medium_minus"],
    [21, "medium"],
    [26, "medium_plus"],
    [31, "hard"],
    [36, "very_hard"],
    [41, "critical"],
    [46, "legendary"],
    [51, "godly"],
  ])("maps stat total %i to %s", (total, expectedId) => {
    expect(getStatRollSuccessLevel(total).id).toBe(expectedId);
  });

  it("treats initial d20 1 as fumble even when total would otherwise succeed", () => {
    expect(getSkillRollSuccessLevel(50, 1).id).toBe("fumble");
    expect(getSkillRollSuccessLevel(50).id).toBe("critical");
  });

  it("builds success-level calculation previews", () => {
    expect(
      buildRoleplayCalculationPreview({
        difficulty: "medium",
        skillLabel: "Perception",
        skillValue: 31,
      })
    ).toMatchObject({
      autoSuccess: true,
      calculationText: "Perception 31 + 1d20 = pending vs Medium · Automatic success — no roll needed",
      numericSubtotal: undefined,
    });

    expect(
      buildRoleplayCalculationPreview({
        difficulty: "hard",
        roll: { dieResult: 12, openEndedD10s: [], rollD20: 12 },
        skillLabel: "Perception",
        skillValue: 12,
        otherMod: -2,
      })
    ).toMatchObject({
      numericSubtotal: 22,
      success: false,
    });
  });

  it("compares opposed rolls by total, ties, and fumbles", () => {
    expect(
      compareRoleplayOpposedRolls({
        actorLabel: "A",
        actorPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 16, openEndedD10s: [], rollD20: 16 },
          skillLabel: "Stealth",
          skillValue: 14,
        }),
        opponentLabel: "B",
        opponentPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 10, openEndedD10s: [], rollD20: 10 },
          skillLabel: "Perception",
          skillValue: 12,
        }),
      })
    ).toEqual({ margin: 8, result: "win", summary: "A wins by 8." });

    expect(
      compareRoleplayOpposedRolls({
        actorLabel: "A",
        actorPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 4, openEndedD10s: [], rollD20: 4 },
          skillLabel: "Stealth",
          skillValue: 10,
        }),
        opponentLabel: "B",
        opponentPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 16, openEndedD10s: [], rollD20: 16 },
          skillLabel: "Perception",
          skillValue: 14,
        }),
      })
    ).toEqual({ margin: 16, result: "loss", summary: "B wins by 16." });

    expect(
      compareRoleplayOpposedRolls({
        actorLabel: "A",
        actorPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 10, openEndedD10s: [], rollD20: 10 },
          skillLabel: "Stealth",
          skillValue: 12,
        }),
        opponentLabel: "B",
        opponentPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 10, openEndedD10s: [], rollD20: 10 },
          skillLabel: "Perception",
          skillValue: 12,
        }),
      }).result
    ).toBe("tie");

    expect(
      compareRoleplayOpposedRolls({
        actorLabel: "A",
        actorPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: -5, openEndedD10s: [6], rollD20: 1 },
          skillLabel: "Stealth",
          skillValue: 40,
        }),
        opponentLabel: "B",
        opponentPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: -5, openEndedD10s: [6], rollD20: 1 },
          skillLabel: "Perception",
          skillValue: 40,
        }),
      }).summary
    ).toBe("Both sides fumbled; tied result.");

    expect(
      compareRoleplayOpposedRolls({
        actorLabel: "A",
        actorPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: -5, openEndedD10s: [6], rollD20: 1 },
          skillLabel: "Stealth",
          skillValue: 40,
        }),
        opponentLabel: "B",
        opponentPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 4, openEndedD10s: [], rollD20: 4 },
          skillLabel: "Perception",
          skillValue: 10,
        }),
      }).result
    ).toBe("loss");
  });

  it("ranks GM roll results by numeric subtotal, then createdAt descending", () => {
    expect(
      rankRoleplayGmRollResults({
        actionLog: [
          { type: "gm_skill_roll", mode: "difficulty", numericSubtotal: 28, skillLabel: "A", createdAt: "2026-01-01T00:01:00Z", fumble: false } as never,
          { type: "gm_skill_roll", mode: "difficulty", numericSubtotal: 28, skillLabel: "B", createdAt: "2026-01-01T00:02:00Z", fumble: false } as never,
          { type: "gm_skill_roll", mode: "difficulty", numericSubtotal: 15, skillLabel: "C", createdAt: "2026-01-01T00:03:00Z", fumble: false } as never,
          { type: "gm_skill_roll", mode: "difficulty", numericSubtotal: 10, skillLabel: "D", createdAt: "2026-01-01T00:04:00Z", fumble: true } as never,
        ],
        currentRankedRollStackId: undefined,
        gmMessage: "",
        participantDescriptions: {},
        pendingSkillRolls: [],
        visibility: {},
      }).map((e) => e.skillLabel)
    ).toEqual(["B", "A", "C", "D"]);
  });

  it("orders roleplay roster participants by PC, NPC, temporary/ad-hoc, then name", () => {
    const rows = orderRoleplayEncounterParticipants([
      { id: "scenario-wolf", label: "Wolf", participantType: "ad-hoc" } as never,
      { id: "scenario-b", label: "Berta", participantType: "scenario", scenarioParticipantId: "npc-2" } as never,
      { characterId: "char-1", id: "char-1", label: "Alya", participantType: "character" } as never,
      { id: "scenario-a", label: "Acolyte", participantType: "scenario", scenarioParticipantId: "npc-1" } as never,
    ]);

    expect(rows.map((row) => row.label)).toEqual(["Alya", "Acolyte", "Berta", "Wolf"]);
  });
});

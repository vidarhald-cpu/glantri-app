import { describe, expect, it, vi } from "vitest";

import type { EncounterParticipant, EncounterSession } from "./session";
import {
  assignRoleplaySkillRoll,
  buildRoleplayCalculationPreview,
  compareRoleplayOpposedRolls,
  getSkillRollSuccessLevel,
  getStatRollSuccessLevel,
  rollOpenEndedRoleplayD20,
  normalizeRoleplayState,
  normalizeRoleplayOtherMod,
  orderRoleplayEncounterParticipants,
  rankRoleplayGmRollResults,
  recordRoleplayGmSkillRoll,
  roleplayDifficultyOptions,
  selectAllRoleplayVisibilityForViewer,
  updateRoleplayGmMessage,
  updateRoleplayParticipantDescription,
  updateRoleplayVisibility,
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

function participant(input: Partial<EncounterParticipant> & Pick<EncounterParticipant, "id" | "label">): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    initiative: 0,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    ...input,
  };
}

describe("roleplay encounter state", () => {
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

  it("updates GM message, visibility, row select-all, and participant descriptions", () => {
    const withMessage = updateRoleplayGmMessage({
      message: "The rain muffles every footstep.",
      session: createSession(),
    });
    expect(normalizeRoleplayState(withMessage).gmMessage).toBe("The rain muffles every footstep.");

    const withCell = updateRoleplayVisibility({
      session: withMessage,
      targetParticipantId: "target-1",
      viewerParticipantId: "viewer-1",
      visible: true,
    });
    expect(normalizeRoleplayState(withCell).visibility["viewer-1"]?.["target-1"]).toBe(true);

    const withRow = selectAllRoleplayVisibilityForViewer({
      participantIds: ["viewer-1", "target-1", "target-2"],
      session: withCell,
      viewerParticipantId: "viewer-1",
    });
    expect(normalizeRoleplayState(withRow).visibility["viewer-1"]).toEqual({
      "target-1": true,
      "target-2": true,
    });

    const withDescription = updateRoleplayParticipantDescription({
      description: {
        detailedDescription: "Recognizable court accent.",
        name: "Quiet Scholar",
        shortDescription: "Ink-stained sleeves.",
      },
      participantId: "viewer-1",
      session: withRow,
    });
    expect(normalizeRoleplayState(withDescription).participantDescriptions["viewer-1"]).toMatchObject({
      name: "Quiet Scholar",
      shortDescription: "Ink-stained sleeves.",
    });
  });

  it("stores skill roll assignments and GM rolls with silent flags", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const assigned = assignRoleplaySkillRoll({
      difficulty: "hard",
      participantId: "participant-1",
      session: createSession(),
      silent: true,
      skillId: "perception",
      skillLabel: "Perception",
      skillValue: 12,
      useDbMod: true,
      useGenMod: true,
      useObSkillMod: false,
      otherMod: -2,
    });
    const assignedState = normalizeRoleplayState(assigned);

    expect(assignedState.pendingSkillRolls[0]).toMatchObject({
      difficulty: "hard",
      otherMod: -2,
      participantId: "participant-1",
      silent: true,
      skillId: "perception",
      skillLabel: "Perception",
      skillValue: 12,
      useDbMod: true,
      useGenMod: true,
      useObSkillMod: false,
    });
    expect(assignedState.actionLog[0]).toMatchObject({
      otherMod: -2,
      silent: true,
      type: "skill_roll_assigned",
      useDbMod: true,
      useGenMod: true,
    });

    const roll = { dieResult: 12, openEndedD10s: [], rollD20: 12 };
    const preview = buildRoleplayCalculationPreview({
      difficulty: "hard",
      otherMod: -2,
      roll,
      skillLabel: "Perception",
      skillValue: 12,
      useGenMod: true,
    });
    const rolled = recordRoleplayGmSkillRoll({
      calculationText: preview.calculationText,
      difficulty: "hard",
      achievedSuccessLevel: preview.achievedSuccessLevel,
      finalTotal: preview.finalTotal,
      numericSubtotal: preview.numericSubtotal,
      otherMod: -2,
      participantId: "participant-1",
      roll,
      session: assigned,
      silent: false,
      skillId: "perception",
      skillLabel: "Perception",
      success: preview.success,
      useGenMod: true,
    });

    expect(normalizeRoleplayState(rolled).actionLog[0]).toMatchObject({
      achievedSuccessLevelLabel: "Medium -",
      calculationText: "Perception 12 + roll 12 + Other -2 = 22 → Medium -, modifier +0 → NOT SUCCESSFUL vs Hard",
      numericSubtotal: 22,
      otherMod: -2,
      roll: 12,
      rollD20: 12,
      silent: false,
      success: false,
      type: "gm_skill_roll",
      useGenMod: true,
    });
  });

  it("stores opposed roll assignment and support skill metadata", () => {
    const assigned = assignRoleplaySkillRoll({
      difficulty: "medium",
      mode: "opposed",
      opponentParticipantId: "opponent-1",
      opponentParticipantName: "The Gladiator",
      opponentSkillId: "perception",
      opponentSkillLabel: "Perception",
      opponentSkillValue: 12,
      opponentSilent: true,
      participantId: "actor-1",
      session: createSession(),
      silent: true,
      skillId: "stealth",
      skillLabel: "Stealth",
      skillValue: 14,
      supportSkillId: "streetwise",
      supportSkillLabel: "Streetwise",
    });
    const state = normalizeRoleplayState(assigned);

    expect(state.pendingSkillRolls[0]).toMatchObject({
      mode: "opposed",
      opponentParticipantId: "opponent-1",
      opponentSilent: true,
      opponentSkillId: "perception",
      opponentSkillValue: 12,
      supportSkillId: "streetwise",
    });
    expect(state.actionLog[0]).toMatchObject({
      mode: "opposed",
      opponentSilent: true,
      opponentSkillLabel: "Perception",
      supportSkillLabel: "Streetwise",
      type: "skill_roll_assigned",
    });
  });

  it("compares opposed rolls by total, ties, and fumbles deterministically", () => {
    const actor = buildRoleplayCalculationPreview({
      roll: { dieResult: 16, openEndedD10s: [], rollD20: 16 },
      skillLabel: "Stealth",
      skillValue: 14,
      otherMod: -2,
    });
    const opponent = buildRoleplayCalculationPreview({
      roll: { dieResult: 10, openEndedD10s: [], rollD20: 10 },
      skillLabel: "Perception",
      skillValue: 12,
    });

    expect(
      compareRoleplayOpposedRolls({
        actorLabel: "Scyrian cavalry guy",
        actorPreview: actor,
        opponentLabel: "The Gladiator",
        opponentPreview: opponent,
      })
    ).toEqual({
      margin: 6,
      result: "win",
      summary: "Scyrian cavalry guy wins by 6.",
    });

    expect(
      compareRoleplayOpposedRolls({
        actorLabel: "Actor",
        actorPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 10, openEndedD10s: [], rollD20: 10 },
          skillLabel: "Stealth",
          skillValue: 12,
        }),
        opponentLabel: "Opponent",
        opponentPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 12, openEndedD10s: [], rollD20: 12 },
          skillLabel: "Perception",
          skillValue: 10,
        }),
      }).result
    ).toBe("tie");

    expect(
      compareRoleplayOpposedRolls({
        actorLabel: "Actor",
        actorPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: -5, openEndedD10s: [6], rollD20: 1 },
          skillLabel: "Stealth",
          skillValue: 40,
        }),
        opponentLabel: "Opponent",
        opponentPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: 4, openEndedD10s: [], rollD20: 4 },
          skillLabel: "Perception",
          skillValue: 10,
        }),
      }).result
    ).toBe("loss");

    expect(
      compareRoleplayOpposedRolls({
        actorLabel: "Actor",
        actorPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: -5, openEndedD10s: [6], rollD20: 1 },
          skillLabel: "Stealth",
          skillValue: 40,
        }),
        opponentLabel: "Opponent",
        opponentPreview: buildRoleplayCalculationPreview({
          roll: { dieResult: -5, openEndedD10s: [6], rollD20: 1 },
          skillLabel: "Perception",
          skillValue: 40,
        }),
      }).summary
    ).toBe("Both sides fumbled; tied result.");
  });

  it("records opposed GM rolls with both sides and comparison result", () => {
    const actorPreview = buildRoleplayCalculationPreview({
      roll: { dieResult: 16, openEndedD10s: [], rollD20: 16 },
      skillLabel: "Stealth",
      skillValue: 14,
      otherMod: -2,
    });
    const opponentPreview = buildRoleplayCalculationPreview({
      roll: { dieResult: 10, openEndedD10s: [], rollD20: 10 },
      skillLabel: "Perception",
      skillValue: 12,
    });
    const opposed = compareRoleplayOpposedRolls({
      actorLabel: "Scyrian cavalry guy",
      actorPreview,
      opponentLabel: "The Gladiator",
      opponentPreview,
    });
    const rolled = recordRoleplayGmSkillRoll({
      achievedSuccessLevel: actorPreview.achievedSuccessLevel,
      calculationText: "opposed roll",
      difficulty: "medium",
      mode: "opposed",
      numericSubtotal: actorPreview.numericSubtotal,
      opposedMargin: opposed.margin,
      opposedResult: opposed.result,
      opponentAchievedSuccessLevel: opponentPreview.achievedSuccessLevel,
      opponentNumericSubtotal: opponentPreview.numericSubtotal,
      opponentParticipantId: "opponent-1",
      opponentParticipantName: "The Gladiator",
      opponentRoll: { dieResult: 10, openEndedD10s: [], rollD20: 10 },
      opponentSkillId: "perception",
      opponentSkillLabel: "Perception",
      opponentSilent: true,
      otherMod: -2,
      participantId: "actor-1",
      roll: { dieResult: 16, openEndedD10s: [], rollD20: 16 },
      session: createSession(),
      silent: true,
      skillId: "stealth",
      skillLabel: "Stealth",
      supportSkillId: "streetwise",
      supportSkillLabel: "Streetwise",
    });

    expect(normalizeRoleplayState(rolled).actionLog[0]).toMatchObject({
      mode: "opposed",
      numericSubtotal: 28,
      opponentNumericSubtotal: 22,
      opponentSilent: true,
      opposedMargin: 6,
      opposedResult: "win",
      silent: true,
      supportSkillLabel: "Streetwise",
    });
  });

  it("normalizes other mods and builds success-level calculation previews", () => {
    expect(normalizeRoleplayOtherMod("")).toBe(0);
    expect(normalizeRoleplayOtherMod("-2")).toBe(-2);
    expect(normalizeRoleplayOtherMod(3.8)).toBe(3);
    expect(normalizeRoleplayOtherMod("bogus")).toBe(0);

    expect(
      buildRoleplayCalculationPreview({
        difficulty: "medium",
        skillLabel: "Perception",
        skillValue: 31,
      })
    ).toMatchObject({
      autoSuccess: true,
      calculationText: "Perception 31 + <DIE ROLL> = pending vs Medium · Automatic success — no roll needed",
      numericSubtotal: undefined,
    });

    expect(
      buildRoleplayCalculationPreview({
        difficulty: "medium",
        otherMod: -2,
        roll: { dieResult: 14, openEndedD10s: [], rollD20: 14 },
        skillLabel: "Perception",
        skillValue: 20,
      })
    ).toMatchObject({
      achievedSuccessLevel: expect.objectContaining({ id: "medium_plus", resultModifier: 1 }),
      compactCalculationText: "Perception 20 + [ -2 ] -2 + 14 = 32 · Medium + · SUCCESS vs Medium",
      calculationText: "Perception 20 + roll 14 + Other -2 = 32 → Medium +, modifier +1 → SUCCESS vs Medium",
      numericModifierParts: [-2],
      numericModifierSum: -2,
      numericSubtotal: 32,
      success: true,
    });

    expect(
      buildRoleplayCalculationPreview({
        difficulty: "hard",
        roll: { dieResult: 7, openEndedD10s: [], rollD20: 7 },
        skillLabel: "Stealth",
        skillValue: 10,
        useDbMod: true,
        useGenMod: true,
      })
    ).toMatchObject({
      compactCalculationText: "Stealth 10 + [ ] 0 + 7 = 17 · Easy · NOT SUCCESSFUL vs Hard",
      calculationText: "Stealth 10 + roll 7 = 17 → Easy, modifier +0 → NOT SUCCESSFUL vs Hard",
      hasPlaceholderMods: true,
      numericSubtotal: 17,
      numericModifierParts: [],
      numericModifierSum: 0,
      pendingModifierLabels: ["Gen", "DB"],
      partial: true,
    });
  });

  it("ranks GM roll results by numeric subtotal", () => {
    const first = recordRoleplayGmSkillRoll({
      calculationText: "Bow 12 + roll 10 = 22",
      difficulty: "medium",
      achievedSuccessLevel: getSkillRollSuccessLevel(22, 10),
      numericSubtotal: 22,
      participantId: "participant-1",
      roll: { dieResult: 10, openEndedD10s: [], rollD20: 10 },
      session: createSession(),
      silent: false,
      skillId: "bow",
      skillLabel: "Bow",
    });
    const second = recordRoleplayGmSkillRoll({
      calculationText: "Stealth 10 + roll 18 = 28",
      difficulty: "medium",
      achievedSuccessLevel: getSkillRollSuccessLevel(28, 18),
      numericSubtotal: 28,
      participantId: "participant-2",
      roll: { dieResult: 18, openEndedD10s: [], rollD20: 18 },
      session: first,
      silent: true,
      skillId: "stealth",
      skillLabel: "Stealth",
    });

    expect(rankRoleplayGmRollResults(normalizeRoleplayState(second)).map((entry) => entry.skillLabel)).toEqual([
      "Stealth",
      "Bow",
    ]);
  });

  it.each([
    { d10s: [], d20: 14, total: 14 },
    { d10s: [7], d20: 20, total: 27 },
    { d10s: [10, 3], d20: 20, total: 33 },
    { d10s: [6], d20: 1, total: -5 },
    { d10s: [10, 4], d20: 1, total: -13 },
  ])("rolls roleplay open-ended d20 totals", ({ d10s, d20, total }) => {
    const rolls = [(d20 - 0.5) / 20, ...d10s.map((roll) => (roll - 0.5) / 10)];
    const result = rollOpenEndedRoleplayD20(() => rolls.shift() ?? 0.5);

    expect(result).toEqual({ dieResult: total, openEndedD10s: d10s, rollD20: d20 });
  });

  it.each([
    [10, "fumble"],
    [11, "trivial_success"],
    [15, "trivial_success"],
    [16, "easy"],
    [20, "easy"],
    [21, "medium_minus"],
    [25, "medium_minus"],
    [26, "medium"],
    [30, "medium"],
    [31, "medium_plus"],
    [35, "medium_plus"],
    [36, "hard"],
    [40, "hard"],
    [41, "very_hard"],
    [45, "very_hard"],
    [46, "critical"],
    [50, "critical"],
    [51, "legendary"],
    [55, "legendary"],
    [56, "godly"],
  ])("maps skill total %i to %s", (total, expectedId) => {
    expect(getSkillRollSuccessLevel(total).id).toBe(expectedId);
  });

  it.each([
    [5, "fumble"],
    [6, "trivial_success"],
    [10, "trivial_success"],
    [11, "easy"],
    [15, "easy"],
    [16, "medium_minus"],
    [20, "medium_minus"],
    [21, "medium"],
    [25, "medium"],
    [26, "medium_plus"],
    [30, "medium_plus"],
    [31, "hard"],
    [35, "hard"],
    [36, "very_hard"],
    [40, "very_hard"],
    [41, "critical"],
    [45, "critical"],
    [46, "legendary"],
    [50, "legendary"],
    [51, "godly"],
  ])("maps stat total %i to %s", (total, expectedId) => {
    expect(getStatRollSuccessLevel(total).id).toBe(expectedId);
  });

  it("treats initial d20 1 as fumble even when total would otherwise succeed", () => {
    const preview = buildRoleplayCalculationPreview({
      difficulty: "medium",
      roll: { dieResult: -5, openEndedD10s: [6], rollD20: 1 },
      skillLabel: "Perception",
      skillValue: 40,
    });

    expect(preview).toMatchObject({
      achievedSuccessLevel: expect.objectContaining({ id: "fumble" }),
      calculationText: "Perception 40 + roll 1-6 = 35 → FUMBLE — automatic fail → NOT SUCCESSFUL vs Medium",
      fumble: true,
      success: false,
    });
  });

  it("requires threshold plus five for automatic success", () => {
    expect(
      buildRoleplayCalculationPreview({
        difficulty: "medium",
        skillLabel: "Perception",
        skillValue: 31,
      }).autoSuccess
    ).toBe(true);
    expect(
      buildRoleplayCalculationPreview({
        difficulty: "medium",
        skillLabel: "Perception",
        skillValue: 30,
      }).autoSuccess
    ).toBe(false);
  });

  it("orders roleplay roster participants by PC, NPC, temporary/ad-hoc, then name", () => {
    const rows = orderRoleplayEncounterParticipants([
      participant({ id: "scenario-wolf", label: "Wolf", participantType: "ad-hoc" }),
      participant({ id: "scenario-b", label: "Berta", participantType: "scenario", scenarioParticipantId: "npc-2" }),
      participant({ characterId: "char-1", id: "char-1", label: "Alya", participantType: "character" }),
      participant({ id: "scenario-a", label: "Acolyte", participantType: "scenario", scenarioParticipantId: "npc-1" }),
    ]);

    expect(rows.map((row) => row.label)).toEqual(["Alya", "Acolyte", "Berta", "Wolf"]);
  });
});

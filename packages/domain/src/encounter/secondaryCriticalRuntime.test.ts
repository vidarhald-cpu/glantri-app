import { describe, expect, it } from "vitest";

import type { EncounterParticipant, EncounterSession } from "./session";

import { encounterSessionSchema } from "./session";

import {
  RECOGNIZED_SECONDARY_CRITICAL_CODES,
  applySecondaryCriticalGradeReduction,
  applyWeaponPrimaryCriticalGradeMaximum,
  parseSecondaryCriticalCode,
  parseWeaponPrimaryCriticalGradeMaximum,
  resolveSecondaryCriticalGrade,
} from "./critical";
import {
  buildCombatRoundAttackRollResult,
  initializeCombatRoundPhaseResolutionCursor,
  initializeCombatRoundState,
  recordCombatRoundAttackResult,
  recordCombatRoundDeclaration,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDamageResult,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundParryResult as recordCanonicalCombatRoundParryResult,
  reviewCombatRoundDamageResult,
  combatRoundStateSchema,
  getCombatRoundPhaseResolutionStatus,
  setCombatRoundParticipantInitiative,
} from "./combatRoundManager";

/**
 * Regression examples R1-R16 of Forgejo #411, the executable statement of the settled Secondary
 * Critical rules (`docs/decisions/rules/0006-secondary-critical-resolution.md`,
 * `docs/rules/secondary-critical-sec-grammar.md`). Every runtime example injects its dice, so the
 * whole file is deterministic.
 */

function participant(input: { id: string; label: string }): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${input.id}`,
  };
}

function encounter(): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 3,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [
      participant({ id: "gladiator", label: "The Gladiator" }),
      participant({ id: "guard", label: "City guard" }),
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "Secondary Critical runtime",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

function declareAttackAction(
  state: ReturnType<typeof initializeCombatRoundState>,
): ReturnType<typeof initializeCombatRoundState> {
  const phaseContext = {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    targetParticipantId: "guard",
  };

  return recordCombatRoundDeclaration({
    declaration: {
      actionId: "attack_parry",
      phaseContexts: { phase1: phaseContext, phase2: phaseContext },
      roundNumber: 3,
    },
    participantId: "gladiator",
    state,
    submittedBy: "gm",
  });
}

/**
 * The canonical parry recorder refuses to advance while the attacker's substep is still the
 * defence review, which this fixture does not exercise. The repository's own combatRoundManager
 * suite uses the same shim to step past it.
 */
function recordCombatRoundParryResult(
  input: Parameters<typeof recordCanonicalCombatRoundParryResult>[0],
) {
  const currentStatus = getCombatRoundPhaseResolutionStatus({
    participantId: input.attackResult.attackerParticipantId,
    phase: input.attackResult.phase,
    state: input.state,
  });
  const state =
    currentStatus.substep === "defense"
      ? combatRoundStateSchema.parse({
          ...input.state,
          phaseResolutionCursor: {
            participantId: input.attackResult.defenderParticipantId,
            phase: input.attackResult.phase,
            substep: "parry",
          },
          phaseResolutionStatuses: {
            ...input.state.phaseResolutionStatuses,
            [input.attackResult.attackerParticipantId]: {
              ...input.state.phaseResolutionStatuses[input.attackResult.attackerParticipantId],
              [input.attackResult.phase]: {
                substep: "parry",
                updatedAt: input.updatedAt,
              },
            },
          },
        })
      : input.state;

  return recordCanonicalCombatRoundParryResult({ ...input, state });
}

/**
 * `damageLookupTotal = hitLookupTotal + dmb + defenderDm`, and the To Hit table maps that total to
 * the Primary Critical grade. With this fixture's `ob`/`db`/roll the hit lookup total is 14, so
 * `dmb` alone selects the grade the Primary resolves at before the `Crit 1` cap.
 */
const DMB_FOR_UNCAPPED_PRIMARY_GRADE = {
  a: 6,
  b: 8,
  c: 10,
  d: 12,
  e: 14,
  f: 16,
} as const;

function resolveAttack(input: {
  criticalDice?: [number, number];
  hitLocationRolls?: number[];
  rng?: () => number;
  uncappedPrimaryGrade: keyof typeof DMB_FOR_UNCAPPED_PRIMARY_GRADE;
  weaponCriticalCode?: string;
  weaponDamageClass?: string;
  weaponName?: string;
  weaponSecondaryCriticalCode?: string;
}) {
  const state = initializeCombatRoundPhaseResolutionCursor({
    phase: "phase1",
    state: setCombatRoundParticipantInitiative({
      initiative: { baseInitiative: 0, modifierAdjustment: 0, rolls: [6], rollTotal: 6, total: 6 },
      participantId: "gladiator",
      phase: "phase1",
      state: declareAttackAction(initializeCombatRoundState({ encounter: encounter() })),
    }),
    updatedAt: "2026-01-01T00:02:00.000Z",
  });
  const attackResult = buildCombatRoundAttackRollResult({
    actionId: "attack_parry",
    attackerParticipantId: "gladiator",
    defenderDb: 10,
    defenderParticipantId: "guard",
    ob: 10,
    phase: "phase1",
    rollD20: 14,
    rollTotal: 14,
    rolledAt: "2026-01-01T00:03:00.000Z",
    weaponCriticalCode: input.weaponCriticalCode,
    weaponDamageClass: input.weaponDamageClass,
    weaponName: input.weaponName ?? "Great sword",
    weaponSecondaryCriticalCode: input.weaponSecondaryCriticalCode,
  });
  const afterAttack = recordCombatRoundAttackResult({
    command: { createdAt: attackResult.rolledAt, createdByUserId: "gm-1" },
    participantId: "gladiator",
    result: attackResult,
    state,
    submittedBy: "gm",
  });
  const afterParry = recordCombatRoundParryResult({
    attackResult,
    command: { createdAt: "2026-01-01T00:04:00.000Z", createdByUserId: "gm-1" },
    parryResolution: {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 8,
      rollTotal: 8,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 17,
    },
    state: afterAttack,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });
  const afterLocation = recordCombatRoundHitLocationRoll({
    attackResult,
    hitLocationRolls: input.hitLocationRolls ?? [12],
    rolledByParticipantId: "gladiator",
    state: afterParry,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:30.000Z",
  });
  const afterDamage = recordCombatRoundDamageResult({
    attackResult,
    defenderDm: 0,
    dmb: DMB_FOR_UNCAPPED_PRIMARY_GRADE[input.uncappedPrimaryGrade],
    state: afterLocation,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:00.000Z",
  });
  const afterCritical = recordCombatRoundCriticalRoll({
    attackResult,
    // A fixed Primary 2d8 so the Secondary's fresh 2d8 is provably a different, independent roll.
    criticalDice: input.criticalDice ?? [5, 5],
    rng: input.rng,
    rolledByParticipantId: "gladiator",
    state: afterDamage,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:30.000Z",
  });
  const resolution = afterCritical.phaseResolutionResults[0];
  const proposal = resolution?.damageResult?.review?.criticalEffectProposal;

  return {
    attackResult,
    criticalRoll: resolution?.criticalRoll,
    damageResult: resolution?.damageResult,
    proposal,
    secondary: proposal?.secondary,
    state: afterCritical,
  };
}

/**
 * A constant `rng` whose every draw yields the same d8 face. A constant stream is used rather than
 * a scripted one because the Primary's own effect rolls consume from the same stream first, and
 * the point of these examples is the Secondary's values, not the draw order.
 */
function constantD8Rng(die: number): () => number {
  return () => (die - 1) / 8 + 1 / 16;
}

describe("Secondary Critical grade chain (rule decision 0006 §2-§3)", () => {
  const cases = [
    {
      code: "DC",
      example: "R1",
      expected: "d",
      family: "blunt",
      primary: "f",
      weapon: "Great sword",
    },
    { code: "AC", example: "R2", expected: "a", family: "blunt", primary: "d", weapon: "Hatchet" },
    { code: "AC", example: "R3", expected: "a", family: "blunt", primary: "e", weapon: "Wood axe" },
    { code: "CC", example: "R4", expected: "c", family: "blunt", primary: "f", weapon: "Hand axe" },
    {
      code: "BS",
      example: "R5",
      expected: "b",
      family: "sharp",
      primary: "f",
      weapon: "2-h Spear",
    },
    {
      code: "AS",
      example: "R6",
      expected: "a",
      family: "sharp",
      primary: "f",
      weapon: "1-h Spear",
    },
    {
      code: "AP",
      example: "R7",
      expected: "a",
      family: "pointed_weapons",
      primary: "f",
      weapon: "Morning star",
    },
    {
      code: "DC",
      example: "R8",
      expected: "d",
      family: "blunt",
      primary: "f",
      weapon: "Battle Axe",
    },
  ] as const;

  it.each(cases)(
    "$example resolves $weapon Sec $code from Primary $primary to Secondary $expected ($family)",
    ({ code, expected, family, primary }) => {
      const resolution = resolveSecondaryCriticalGrade({
        resolvedPrimaryCriticalGrade: primary,
        weaponSecondaryCriticalCode: code,
      });

      expect(resolution.status).toBe("resolved");
      if (resolution.status !== "resolved") return;
      expect(resolution.secondaryCriticalGrade).toBe(expected);
      expect(resolution.family).toBe(family);
      expect(resolution.rawCode).toBe(code);
    },
  );

  it("R9/R10 produce no Secondary when the Primary resolves at B or A, before any cap", () => {
    for (const primary of ["b", "a"] as const) {
      const resolution = resolveSecondaryCriticalGrade({
        resolvedPrimaryCriticalGrade: primary,
        weaponSecondaryCriticalCode: "DC",
      });

      expect(resolution.status).toBe("none");
      expect(applySecondaryCriticalGradeReduction(primary)).toBeUndefined();
    }
  });

  it("R11 treats a blank or absent Sec as an authored absence, with no warning", () => {
    for (const rawCode of [undefined, null, ""]) {
      const resolution = resolveSecondaryCriticalGrade({
        resolvedPrimaryCriticalGrade: "f",
        weaponSecondaryCriticalCode: rawCode,
      });

      expect(resolution.status).toBe("none");
    }

    expect(parseSecondaryCriticalCode(undefined).status).toBe("absent");
  });

  it("R12 fails closed on a structurally valid but unattested code", () => {
    const resolution = resolveSecondaryCriticalGrade({
      resolvedPrimaryCriticalGrade: "f",
      weaponSecondaryCriticalCode: "BP",
    });

    expect(resolution.status).toBe("unrecognized");
    if (resolution.status !== "unrecognized") return;
    expect(resolution.rawCode).toBe("BP");
    expect(resolution.reason).toContain("BP");
    expect(RECOGNIZED_SECONDARY_CRITICAL_CODES).not.toContain("BP");
  });

  it("R13 never splits a qualifier, repairs a sentinel, or accepts whitespace", () => {
    for (const rawCode of ["FP cs", "N/A", " ", "A C", "dc!", "EC"]) {
      const resolution = resolveSecondaryCriticalGrade({
        resolvedPrimaryCriticalGrade: "f",
        weaponSecondaryCriticalCode: rawCode,
      });

      expect(resolution.status).toBe("unrecognized");
      if (resolution.status !== "unrecognized") continue;
      expect(resolution.rawCode).toBe(rawCode);
    }
  });

  it("normalizes by trimming and upper-casing only, preserving the raw code", () => {
    const resolution = resolveSecondaryCriticalGrade({
      resolvedPrimaryCriticalGrade: "f",
      weaponSecondaryCriticalCode: "  dc ",
    });

    expect(resolution.status).toBe("resolved");
    if (resolution.status !== "resolved") return;
    expect(resolution.code).toBe("DC");
    expect(resolution.rawCode).toBe("  dc ");
  });

  it("caps but never raises: a reduced grade at or below the Sec maximum resolves as reduced", () => {
    const resolution = resolveSecondaryCriticalGrade({
      resolvedPrimaryCriticalGrade: "c",
      weaponSecondaryCriticalCode: "DC",
    });

    expect(resolution.status).toBe("resolved");
    if (resolution.status !== "resolved") return;
    expect(resolution.reducedCriticalGrade).toBe("a");
    expect(resolution.secondaryCriticalGrade).toBe("a");
    expect(resolution.gradeCapApplied).toBe(false);
  });
});

describe("Crit 1 Primary cap (rule decision 0006 §2 step 1)", () => {
  it("reads the maximum from the Crit 1 grade letter only", () => {
    expect(parseWeaponPrimaryCriticalGradeMaximum("DS")).toBe("d");
    expect(parseWeaponPrimaryCriticalGradeMaximum("FP cs")).toBe("f");
    expect(parseWeaponPrimaryCriticalGradeMaximum("N/A")).toBeUndefined();
    expect(parseWeaponPrimaryCriticalGradeMaximum(undefined)).toBeUndefined();
  });

  it("only ever lowers a grade", () => {
    expect(
      applyWeaponPrimaryCriticalGradeMaximum({ criticalGrade: "f", weaponCriticalCode: "DS" }),
    ).toBe("d");
    expect(
      applyWeaponPrimaryCriticalGradeMaximum({ criticalGrade: "b", weaponCriticalCode: "DS" }),
    ).toBe("b");
    expect(
      applyWeaponPrimaryCriticalGradeMaximum({ criticalGrade: "f", weaponCriticalCode: "N/A" }),
    ).toBe("f");
  });

  it("caps the Hatchet Primary at D even when the To Hit table returns F", () => {
    const capped = resolveAttack({
      uncappedPrimaryGrade: "f",
      weaponCriticalCode: "DS",
      weaponDamageClass: "blunt",
      weaponName: "Hatchet",
      weaponSecondaryCriticalCode: "AC",
      rng: constantD8Rng(4),
    });

    expect(capped.damageResult?.weaponCriticalGradeMaximum).toBe("d");
    expect(capped.damageResult?.criticalGrade).toBe("d");
    expect(capped.criticalRoll?.criticalGrade).toBe("d");
    // R2: the capped Primary D reduces to B and the Sec maximum A then binds.
    expect(capped.secondary?.primaryCriticalGrade).toBe("d");
    expect(capped.secondary?.reducedCriticalGrade).toBe("b");
    expect(capped.secondary?.criticalGrade).toBe("a");
    expect(capped.secondary?.gradeCapApplied).toBe(true);
  });

  it("leaves an uncapped weapon's Primary untouched", () => {
    const uncapped = resolveAttack({
      uncappedPrimaryGrade: "f",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
    });

    expect(uncapped.damageResult?.weaponCriticalGradeMaximum).toBe("f");
    expect(uncapped.criticalRoll?.criticalGrade).toBe("f");
  });

  it("caps a GM criticalGradeOverride too, because 0006 §2 states no exception", () => {
    const capped = resolveAttack({
      uncappedPrimaryGrade: "b",
      weaponCriticalCode: "DS",
      weaponDamageClass: "blunt",
      weaponName: "Hatchet",
    });
    const attackResultId = capped.damageResult?.attackResultId;

    expect(attackResultId).toBeDefined();
    if (!attackResultId) return;

    const reviewed = reviewCombatRoundDamageResult({
      attackResultId,
      review: { additionalEffects: [], criticalGradeOverride: "f", operationalConsequences: [] },
      reviewedAt: "2026-01-01T00:06:00.000Z",
      state: capped.state,
    });
    const reviewedResult = reviewed.phaseResolutionResults[0]?.damageResult;

    expect(reviewedResult?.review?.criticalGradeOverride).toBe("f");
    expect(
      reviewed.phaseResolutionResults[0]?.damageResult?.review?.criticalEffectProposal,
    ).toBeDefined();
  });
});

describe("Secondary Critical runtime resolution (rule decision 0006 §4-§5)", () => {
  it("R1 resolves the headline Great sword case end to end", () => {
    const resolved = resolveAttack({
      criticalDice: [5, 5],
      rng: constantD8Rng(6),
      uncappedPrimaryGrade: "f",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponSecondaryCriticalCode: "DC",
    });

    expect(resolved.criticalRoll?.criticalGrade).toBe("f");
    expect(resolved.secondary?.code).toBe("DC");
    expect(resolved.secondary?.criticalGrade).toBe("d");
    expect(resolved.secondary?.family).toBe("blunt");
    expect(resolved.secondary?.gradeCapApplied).toBe(false);
    expect(resolved.secondary?.criticalDice).toStrictEqual([6, 6]);
    expect(resolved.secondary?.criticalDiceTotal).toBe(12);
    // Grade d contributes criticalTypeModifier 0; the armor critical modifier is the Primary's.
    expect(resolved.secondary?.criticalTypeModifier).toBe(0);
    expect(resolved.secondary?.armorCriticalModifier).toBe(
      resolved.criticalRoll?.armorCriticalModifier,
    );
    expect(resolved.secondary?.finalCriticalRoll).toBe(12);
  });

  it("R16 reuses the Primary's hit location and rolls genuinely independent dice", () => {
    const resolved = resolveAttack({
      criticalDice: [5, 5],
      hitLocationRolls: [3],
      rng: constantD8Rng(2),
      uncappedPrimaryGrade: "f",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponSecondaryCriticalCode: "DC",
    });

    expect(resolved.secondary?.location).toBe(resolved.proposal?.location);
    expect(resolved.criticalRoll?.criticalDice).toStrictEqual([5, 5]);
    expect(resolved.secondary?.criticalDice).toStrictEqual([2, 2]);
    expect(resolved.criticalRoll?.finalCriticalRoll).not.toBe(
      resolved.secondary?.finalCriticalRoll,
    );
    // The Primary result is untouched by the Secondary.
    expect(resolved.proposal?.family).toBe("sharp");
    expect(resolved.secondary?.family).toBe("blunt");
  });

  it("stacks the Secondary's effects beside the Primary's under distinct identifiers", () => {
    const resolved = resolveAttack({
      criticalDice: [5, 5],
      rng: constantD8Rng(3),
      uncappedPrimaryGrade: "f",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponSecondaryCriticalCode: "DC",
    });
    const effects = resolved.damageResult?.review?.additionalEffects ?? [];
    const secondaryEffects = effects.filter((effect) => effect.criticalRole === "secondary");
    const primaryEffects = effects.filter((effect) => effect.criticalRole === undefined);

    expect(primaryEffects.length).toBeGreaterThan(0);
    expect(secondaryEffects.length).toBeGreaterThan(0);
    expect(new Set(effects.map((effect) => effect.id)).size).toBe(effects.length);
    for (const effect of secondaryEffects) {
      expect(effect.id.startsWith("critical-secondary-effect-")).toBe(true);
    }
  });

  it("R9/R10 record no Secondary at the runtime seam when the Primary resolves at B or A", () => {
    for (const grade of ["b", "a"] as const) {
      const resolved = resolveAttack({
        rng: constantD8Rng(4),
        uncappedPrimaryGrade: grade,
        weaponCriticalCode: "FS",
        weaponDamageClass: "edged",
        weaponSecondaryCriticalCode: "DC",
      });

      expect(resolved.criticalRoll?.criticalGrade).toBe(grade);
      expect(resolved.secondary).toBeUndefined();
      expect(resolved.proposal?.secondaryWarnings).toBeUndefined();
    }
  });

  it("R11/R14/R15 record no Secondary and no warning when the attack mode authors no Sec", () => {
    const resolved = resolveAttack({
      rng: constantD8Rng(4),
      uncappedPrimaryGrade: "f",
      weaponCriticalCode: "FC",
      weaponDamageClass: "blunt",
      weaponName: "Heavy mace",
    });

    expect(resolved.secondary).toBeUndefined();
    expect(resolved.proposal?.secondaryWarnings).toBeUndefined();
  });

  it("R12/R13 fail closed with a recorded warning and no Secondary", () => {
    for (const rawCode of ["BP", "FP cs", "N/A"]) {
      const resolved = resolveAttack({
        rng: constantD8Rng(4),
        uncappedPrimaryGrade: "f",
        weaponCriticalCode: "FS",
        weaponDamageClass: "edged",
        weaponSecondaryCriticalCode: rawCode,
      });

      expect(resolved.secondary).toBeUndefined();
      expect(resolved.proposal?.secondaryWarnings?.length).toBe(1);
      expect(resolved.proposal?.secondaryWarnings?.[0]).toContain(rawCode);
      // The Primary is entirely unaffected by an unrecognized Sec code.
      expect(resolved.proposal?.family).toBe("sharp");
      expect(resolved.criticalRoll?.criticalGrade).toBe("f");
    }
  });

  it("never re-rolls the Secondary's dice when the GM review re-derives the proposal", () => {
    const resolved = resolveAttack({
      criticalDice: [5, 5],
      rng: constantD8Rng(7),
      uncappedPrimaryGrade: "f",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponSecondaryCriticalCode: "DC",
    });
    const attackResultId = resolved.damageResult?.attackResultId;

    expect(resolved.secondary?.criticalDice).toStrictEqual([7, 7]);
    if (!attackResultId || !resolved.damageResult?.review) return;

    const reviewed = reviewCombatRoundDamageResult({
      attackResultId,
      review: resolved.damageResult.review,
      reviewedAt: "2026-01-01T00:06:00.000Z",
      // Deliberately a stream that would produce different dice if it were consulted.
      rng: constantD8Rng(1),
      state: resolved.state,
    });
    const rederived =
      reviewed.phaseResolutionResults[0]?.damageResult?.review?.criticalEffectProposal?.secondary;

    expect(rederived?.criticalDice).toStrictEqual([7, 7]);
    expect(rederived?.finalCriticalRoll).toBe(resolved.secondary?.finalCriticalRoll);
    expect(rederived?.critKey).toBe(resolved.secondary?.critKey);
  });
});

describe("no four-character weaponCriticalCode reaches the domain", () => {
  it("keeps the Crit 1 code and the Sec code as separate attack-result fields", () => {
    const resolved = resolveAttack({
      rng: constantD8Rng(4),
      uncappedPrimaryGrade: "f",
      weaponCriticalCode: "FS",
      weaponDamageClass: "edged",
      weaponSecondaryCriticalCode: "DC",
    });

    expect(resolved.attackResult.weaponCriticalCode).toBe("FS");
    expect(resolved.attackResult.weaponSecondaryCriticalCode).toBe("DC");
    expect(resolved.attackResult.weaponCriticalCode).not.toBe("FSDC");
  });
});

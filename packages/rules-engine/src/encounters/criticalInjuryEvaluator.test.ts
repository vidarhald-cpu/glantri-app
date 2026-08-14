import {
  criticalInjuryFixtureB,
  criticalInjuryFixtureC,
  criticalInjuryFixtureF,
  type OpenEndedD20Roll,
} from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  changeCriticalCareState,
  createCriticalPhysiologyEvaluation,
  createCriticalShockEvaluation,
  evaluateCriticalStatCheck,
  getCriticalPhysiologyCheckpoint,
  getCriticalShockCheckpoint,
  getCriticalStatCheckSuccessProbability,
  getEffectiveCriticalFunctionBand,
  getNextCriticalPhysiologyCheckpointAt,
  resolveCriticalPhysiologyCheckpoint,
  resolveCriticalShockCheckpoint,
  type CriticalPhysiologyEvaluation,
} from "./criticalInjuryEvaluator";
import { resolveParticipantStatRollProfile } from "./resolveParticipantSkillRollProfile";

const START = "2026-08-14T10:00:00.000Z";

function at(milliseconds: number): string {
  return new Date(Date.parse(START) + milliseconds).toISOString();
}

function roll(dieResult: number, rollD20 = dieResult): OpenEndedD20Roll {
  return { dieResult, openEndedD10s: [], rollD20 };
}

function processB() {
  return criticalInjuryFixtureB.physiologyProcesses[0]!;
}

function processC() {
  return criticalInjuryFixtureC.physiologyProcesses[0]!;
}

function processF() {
  return criticalInjuryFixtureF.physiologyProcesses[0]!;
}

function resolveDuePhysiology(input: {
  at: string;
  currentHealth: number;
  evaluation: CriticalPhysiologyEvaluation;
  roll: OpenEndedD20Roll;
}) {
  const due = getCriticalPhysiologyCheckpoint({ at: input.at, evaluation: input.evaluation });
  if (!due.request) throw new Error("Expected a due physiology checkpoint.");
  return resolveCriticalPhysiologyCheckpoint({
    at: input.at,
    currentHealth: input.currentHealth,
    evaluation: input.evaluation,
    request: due.request,
    roll: input.roll,
  });
}

describe("Critical Stat-roll contract", () => {
  it("uses only open-ended d20 + Current Stat against numeric Difficulty", () => {
    expect(evaluateCriticalStatCheck({ currentStat: 12, difficulty: 20, roll: roll(8) })).toEqual({
      currentStat: 12,
      difficulty: 20,
      numberToHit: "Difficulty 20",
      roll: roll(8),
      success: true,
      total: 20,
    });
    expect(
      evaluateCriticalStatCheck({
        currentStat: 12,
        difficulty: 23,
        roll: { dieResult: 24, openEndedD10s: [4], rollD20: 20 },
      }),
    ).toMatchObject({ success: true, total: 36 });
    expect(
      evaluateCriticalStatCheck({ currentStat: 12, difficulty: 20, roll: roll(7) }),
    ).toMatchObject({ success: false, total: 19 });
  });

  it("accepts the canonical #254 Current Stat read without Skill percentage contamination", () => {
    const profile = resolveParticipantStatRollProfile({
      snapshot: {
        generatedHumanoidNpc: {
          stats: { base: { health: 9 }, final: { health: 12 } },
        },
      },
      statId: "health",
    });
    const result = evaluateCriticalStatCheck({
      currentStat: profile.statValue!,
      difficulty: 20,
      roll: roll(8),
    });

    expect(profile).toMatchObject({ sourceQuality: "snapshot", statValue: 12 });
    expect(result).toMatchObject({ currentStat: 12, success: true, total: 20 });
    expect(result).not.toHaveProperty("percentageModifier");
    expect(result).not.toHaveProperty("skillValue");
  });

  it.each([
    [8, 20, 0.45],
    [12, 20, 0.65],
    [16, 20, 0.85],
    [8, 23, 0.3],
    [12, 23, 0.5],
    [16, 23, 0.7],
  ])(
    "calculates exact open-ended probability for Stat %i at Difficulty %i",
    (currentStat, difficulty, expected) => {
      expect(getCriticalStatCheckSuccessProbability({ currentStat, difficulty })).toBe(expected);
    },
  );

  it("supports exact upward open-ended tails without importing Skill success levels", () => {
    expect(getCriticalStatCheckSuccessProbability({ currentStat: 0, difficulty: 25 })).toBeCloseTo(
      0.03,
      12,
    );
    expect(getCriticalStatCheckSuccessProbability({ currentStat: 0, difficulty: 30 })).toBeCloseTo(
      0.005,
      12,
    );
  });
});

describe("ordinary serious and serious internal physiology", () => {
  it("declares Difficulty 20 only at the five-minute ordinary-serious checkpoint", () => {
    const evaluation = createCriticalPhysiologyEvaluation({
      process: processB(),
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });

    expect(
      getCriticalPhysiologyCheckpoint({ at: at(299_999), evaluation }).request,
    ).toBeUndefined();
    expect(getCriticalPhysiologyCheckpoint({ at: at(300_000), evaluation }).request).toMatchObject({
      difficulty: 20,
      numberToHit: "Difficulty 20",
      stat: "health",
    });
  });

  it("advances one of four calibration states on failure and holds on success", () => {
    let evaluation = createCriticalPhysiologyEvaluation({
      process: processB(),
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });

    const first = resolveDuePhysiology({
      at: at(300_000),
      currentHealth: 12,
      evaluation,
      roll: roll(7),
    });
    evaluation = first.evaluation;
    expect(evaluation).toMatchObject({ adverseTransitions: 1, condition: "deteriorating" });

    const held = resolveDuePhysiology({
      at: at(600_000),
      currentHealth: 12,
      evaluation,
      roll: roll(8),
    });
    evaluation = held.evaluation;
    expect(evaluation).toMatchObject({ adverseTransitions: 1, condition: "deteriorating" });

    for (const checkpointAt of [900_000, 1_200_000, 1_500_000]) {
      evaluation = resolveDuePhysiology({
        at: at(checkpointAt),
        currentHealth: 12,
        evaluation,
        roll: roll(7),
      }).evaluation;
    }
    expect(evaluation).toMatchObject({
      adverseTransitions: 4,
      condition: "calibration_limit",
      terminal: undefined,
    });
    expect(
      getCriticalPhysiologyCheckpoint({ at: at(1_800_000), evaluation }).request,
    ).toBeUndefined();
  });

  it("uses the accepted twenty-minute partial-control cadence for serious internal physiology", () => {
    const started = createCriticalPhysiologyEvaluation({
      process: processC(),
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });
    const partial = changeCriticalCareState({
      at: START,
      careState: "partly_controlled",
      evaluation: started,
    });

    expect(getNextCriticalPhysiologyCheckpointAt({ at: START, evaluation: partial })).toBe(
      at(1_200_000),
    );
    expect(
      getCriticalPhysiologyCheckpoint({ at: at(1_199_999), evaluation: partial }).request,
    ).toBeUndefined();
    expect(
      getCriticalPhysiologyCheckpoint({ at: at(1_200_000), evaluation: partial }).request,
    ).toMatchObject({
      difficulty: 20,
      stat: "health",
    });
  });
});

describe("care quality and accumulated exposure", () => {
  it("preserves exposure across pressure removal and reapplication while maintained pressure freezes it", () => {
    let evaluation = createCriticalPhysiologyEvaluation({
      process: processF(),
      startedAt: START,
      terminalPolicy: { kind: "dying_with_deadline" },
    });
    evaluation = changeCriticalCareState({
      at: at(15_000),
      careState: "maintained_pressure",
      evaluation,
    });
    expect(evaluation.exposureMilliseconds).toBe(15_000);

    evaluation = changeCriticalCareState({
      at: at(75_000),
      careState: "not_controlled",
      evaluation,
    });
    expect(evaluation.exposureMilliseconds).toBe(15_000);
    evaluation = changeCriticalCareState({
      at: at(90_000),
      careState: "maintained_pressure",
      evaluation,
    });
    expect(evaluation.exposureMilliseconds).toBe(30_000);
    expect(getCriticalPhysiologyCheckpoint({ at: at(90_000), evaluation }).request).toBeDefined();
  });

  it("uses a sixty-second catastrophic cadence under partial control", () => {
    const evaluation = changeCriticalCareState({
      at: START,
      careState: "partly_controlled",
      evaluation: createCriticalPhysiologyEvaluation({
        process: processF(),
        startedAt: START,
        terminalPolicy: { kind: "content_defined_terminal" },
      }),
    });
    expect(getNextCriticalPhysiologyCheckpointAt({ at: START, evaluation })).toBe(at(60_000));
  });

  it("requires two continuous minutes of effective work for secure control", () => {
    const started = createCriticalPhysiologyEvaluation({
      process: processF(),
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });
    const pressure = changeCriticalCareState({
      at: START,
      careState: "maintained_pressure",
      evaluation: started,
    });
    expect(() =>
      changeCriticalCareState({ at: at(119_999), careState: "secure", evaluation: pressure }),
    ).toThrow("two minutes");
    expect(
      changeCriticalCareState({ at: at(120_000), careState: "secure", evaluation: pressure }),
    ).toMatchObject({ careState: "secure", exposureMilliseconds: 0 });
  });
});

describe("catastrophic-but-treatable and terminal policies", () => {
  it.each([2, 3, 4] as const)("supports stored reserve %i without randomizing it", (reserve) => {
    const evaluation = createCriticalPhysiologyEvaluation({
      process: processF(),
      reserve,
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });
    expect(evaluation.reserve).toBe(reserve);
  });

  it("uses reserve 3, Difficulty 23, one reserve per failed checkpoint, and no multi-step extreme result", () => {
    let evaluation = createCriticalPhysiologyEvaluation({
      process: processF(),
      startedAt: START,
      terminalPolicy: { kind: "dying_with_deadline" },
    });
    const due = getCriticalPhysiologyCheckpoint({ at: at(30_000), evaluation });
    expect(due.request).toMatchObject({ difficulty: 23, numberToHit: "Difficulty 23" });
    if (!due.request) throw new Error("Expected catastrophic checkpoint.");
    evaluation = resolveCriticalPhysiologyCheckpoint({
      at: at(30_000),
      currentHealth: 12,
      evaluation,
      request: due.request,
      roll: { dieResult: -25, openEndedD10s: [10, 10, 6], rollD20: 1 },
    }).evaluation;
    expect(evaluation).toMatchObject({ adverseTransitions: 1, reserve: 2, terminal: undefined });

    evaluation = resolveDuePhysiology({
      at: at(60_000),
      currentHealth: 12,
      evaluation,
      roll: roll(11),
    }).evaluation;
    expect(evaluation).toMatchObject({ adverseTransitions: 1, reserve: 2 });
  });

  it("caches a declared checkpoint result and never rerolls it on repeat action", () => {
    const evaluation = createCriticalPhysiologyEvaluation({
      process: processF(),
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });
    const due = getCriticalPhysiologyCheckpoint({ at: at(30_000), evaluation });
    if (!due.request) throw new Error("Expected catastrophic checkpoint.");
    const first = resolveCriticalPhysiologyCheckpoint({
      at: at(30_000),
      currentHealth: 12,
      evaluation,
      request: due.request,
      roll: roll(10),
    });
    const repeated = resolveCriticalPhysiologyCheckpoint({
      at: at(31_000),
      currentHealth: 12,
      evaluation: first.evaluation,
      request: due.request,
      roll: roll(20),
    });

    expect(repeated.evaluation).toBe(first.evaluation);
    expect(repeated.result).toBe(first.result);
    expect(repeated.result.success).toBe(false);
  });

  it("invokes one explicit dying deadline at reserve zero without implicit death or death saves", () => {
    let evaluation = createCriticalPhysiologyEvaluation({
      process: processF(),
      startedAt: START,
      terminalPolicy: { kind: "dying_with_deadline" },
    });
    for (const checkpointAt of [30_000, 60_000, 90_000]) {
      evaluation = resolveDuePhysiology({
        at: at(checkpointAt),
        currentHealth: 12,
        evaluation,
        roll: roll(10),
      }).evaluation;
    }

    expect(evaluation.terminal).toEqual({
      dead: false,
      deadlineAt: at(120_000),
      invokedAt: at(90_000),
      kind: "dying_with_deadline",
    });
    expect(
      getCriticalPhysiologyCheckpoint({ at: at(180_000), evaluation }).request,
    ).toBeUndefined();
    expect(evaluation.checkpointResults).toHaveLength(3);
  });

  it("keeps content-defined terminal nonfatal and makes fatal-at-impact explicit", () => {
    let contentDefined = createCriticalPhysiologyEvaluation({
      process: processF(),
      reserve: 2,
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });
    contentDefined = resolveDuePhysiology({
      at: at(30_000),
      currentHealth: 8,
      evaluation: contentDefined,
      roll: roll(1),
    }).evaluation;
    contentDefined = resolveDuePhysiology({
      at: at(60_000),
      currentHealth: 8,
      evaluation: contentDefined,
      roll: roll(1),
    }).evaluation;
    expect(contentDefined.terminal).toMatchObject({
      dead: false,
      kind: "content_defined_terminal",
    });

    expect(
      createCriticalPhysiologyEvaluation({
        process: processF(),
        startedAt: START,
        terminalPolicy: { kind: "fatal_at_impact" },
      }).terminal,
    ).toEqual({ dead: true, invokedAt: START, kind: "fatal_at_impact" });
  });
});

describe("serious shock function evaluator", () => {
  it("honors longer authored trauma before the first Constitution Difficulty 20 checkpoint", () => {
    const evaluation = createCriticalShockEvaluation({
      authoredMinimumUntil: at(60_000),
      functionRecord: criticalInjuryFixtureB.functionStates[0]!,
      impactAt: START,
      mandatoryTraumaBand: "no_action",
      structuralFloor: "restricted",
    });
    expect(getEffectiveCriticalFunctionBand(evaluation)).toBe("no_action");
    expect(getCriticalShockCheckpoint({ at: at(59_999), evaluation })).toBeUndefined();
    expect(getCriticalShockCheckpoint({ at: at(60_000), evaluation })).toMatchObject({
      difficulty: 20,
      numberToHit: "Difficulty 20",
      stat: "constitution",
    });
  });

  it("classifies success as restricted and failure as severely impaired without inventing no-action/unconscious", () => {
    const base = createCriticalShockEvaluation({
      functionRecord: criticalInjuryFixtureB.functionStates[0]!,
      impactAt: START,
      mandatoryTraumaBand: "no_action",
    });
    const request = getCriticalShockCheckpoint({ at: at(30_000), evaluation: base })!;
    const success = resolveCriticalShockCheckpoint({
      at: at(30_000),
      currentConstitution: 12,
      evaluation: base,
      request,
      roll: roll(8),
    });
    const failure = resolveCriticalShockCheckpoint({
      at: at(30_000),
      currentConstitution: 12,
      evaluation: base,
      request,
      roll: roll(7),
    });
    expect(success.evaluation.shockBand).toBe("restricted");
    expect(failure.evaluation.shockBand).toBe("severely_impaired");
    expect(failure.evaluation.shockBand).not.toBe("no_action");
    expect(failure.evaluation.shockBand).not.toBe("unconscious");
  });

  it("improves one band every ten minutes while structural floors survive cleared shock", () => {
    const base = createCriticalShockEvaluation({
      functionRecord: criticalInjuryFixtureB.functionStates[0]!,
      impactAt: START,
      mandatoryTraumaBand: "no_action",
      structuralFloor: "restricted",
    });
    const initialRequest = getCriticalShockCheckpoint({ at: at(30_000), evaluation: base })!;
    const classified = resolveCriticalShockCheckpoint({
      at: at(30_000),
      currentConstitution: 12,
      evaluation: base,
      request: initialRequest,
      roll: roll(7),
    }).evaluation;
    const firstRecoveryAt = at(630_000);
    const firstRecoveryRequest = getCriticalShockCheckpoint({
      at: firstRecoveryAt,
      evaluation: classified,
    })!;
    const restricted = resolveCriticalShockCheckpoint({
      at: firstRecoveryAt,
      currentConstitution: 12,
      evaluation: classified,
      request: firstRecoveryRequest,
      roll: roll(8),
    }).evaluation;
    expect(restricted.shockBand).toBe("restricted");
    const secondRecoveryAt = at(1_230_000);
    const secondRecoveryRequest = getCriticalShockCheckpoint({
      at: secondRecoveryAt,
      evaluation: restricted,
    })!;
    const cleared = resolveCriticalShockCheckpoint({
      at: secondRecoveryAt,
      currentConstitution: 12,
      evaluation: restricted,
      request: secondRecoveryRequest,
      roll: roll(8),
    }).evaluation;

    expect(cleared.shockBand).toBe("functioning");
    expect(getEffectiveCriticalFunctionBand(cleared)).toBe("restricted");
    expect(cleared.functionRecord).toBe(criticalInjuryFixtureB.functionStates[0]);
    expect(getCriticalShockCheckpoint({ at: at(1_830_000), evaluation: cleared })).toBeUndefined();
  });

  it("caches the shock result for its declared checkpoint", () => {
    const evaluation = createCriticalShockEvaluation({
      functionRecord: criticalInjuryFixtureB.functionStates[0]!,
      impactAt: START,
      mandatoryTraumaBand: "restricted",
    });
    const request = getCriticalShockCheckpoint({ at: at(30_000), evaluation })!;
    const first = resolveCriticalShockCheckpoint({
      at: at(30_000),
      currentConstitution: 12,
      evaluation,
      request,
      roll: roll(7),
    });
    const repeat = resolveCriticalShockCheckpoint({
      at: at(31_000),
      currentConstitution: 12,
      evaluation: first.evaluation,
      request,
      roll: roll(20),
    });
    expect(repeat.evaluation).toBe(first.evaluation);
    expect(repeat.result).toBe(first.result);
  });
});

describe("inert record compatibility", () => {
  it("references integrated records without changing Critical source, effects, modifiers, or injuries", () => {
    const before = JSON.stringify(criticalInjuryFixtureB);
    const physiology = createCriticalPhysiologyEvaluation({
      process: processB(),
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });
    const shock = createCriticalShockEvaluation({
      functionRecord: criticalInjuryFixtureB.functionStates[0]!,
      impactAt: START,
      mandatoryTraumaBand: "no_action",
    });

    expect(physiology.process).toBe(criticalInjuryFixtureB.physiologyProcesses[0]);
    expect(shock.functionRecord).toBe(criticalInjuryFixtureB.functionStates[0]);
    expect(JSON.stringify(criticalInjuryFixtureB)).toBe(before);
    expect(criticalInjuryFixtureB.operationalEffects[1]?.projections[0]).toMatchObject({
      kind: "combat_modifier",
    });
  });
});

import { criticalInjuryFixtureB, criticalInjuryFixtureC } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import {
  changeCriticalCareState,
  createCriticalPhysiologyEvaluation,
  createCriticalShockEvaluation,
  getCriticalShockCheckpoint,
  resolveCriticalShockCheckpoint,
  type CriticalFunctionBand,
} from "./criticalInjuryEvaluator";
import {
  projectCriticalInjuryForPlayer,
  projectCriticalPhysiologyForGm,
  projectObservableCriticalRisk,
} from "./criticalInjuryPresentation";

const START = "2026-08-14T10:00:00.000Z";
const ALLOWED_ACTIONS: Readonly<Record<CriticalFunctionBand, readonly string[]>> = {
  functioning: ["Normal actions"],
  restricted: ["Move carefully", "Speak"],
  severely_impaired: ["Speak", "Use one simple action"],
  no_action: [],
  unconscious: [],
};

function at(milliseconds: number): string {
  return new Date(Date.parse(START) + milliseconds).toISOString();
}

describe("Critical information and risk presentation", () => {
  it("keeps canonical counters in GM truth and out of the stable player shape", () => {
    const process = criticalInjuryFixtureC.physiologyProcesses[0]!;
    const started = createCriticalPhysiologyEvaluation({
      process,
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });
    const partlyControlled = changeCriticalCareState({
      at: at(300_000),
      careState: "partly_controlled",
      evaluation: started,
    });
    const shock = createCriticalShockEvaluation({
      authoredMinimumUntil: at(1_800_000),
      functionRecord: criticalInjuryFixtureC.functionStates[0]!,
      impactAt: START,
      mandatoryTraumaBand: "restricted",
      structuralFloor: "restricted",
    });
    const common = {
      allowedActionsByBand: ALLOWED_ACTIONS,
      at: at(600_000),
      careState: "partly_controlled" as const,
      injuryCase: criticalInjuryFixtureC,
      revealPhysiologyCheckpoint: false,
      shock,
    };
    const noHiddenProcessSupplied = projectCriticalInjuryForPlayer(common);
    const hiddenProcessSupplied = projectCriticalInjuryForPlayer({
      ...common,
      physiology: partlyControlled,
    });

    expect(hiddenProcessSupplied).toEqual(noHiddenProcessSupplied);
    expect(hiddenProcessSupplied).toEqual({
      allowedActions: ["Move carefully", "Speak"],
      careState: "partly_controlled",
      condition: "Impaired",
      immediateEffects: ["Action impaired"],
      injury: ["Penetrating chest injury"],
      nextMeaningfulCheckpoint: at(1_800_000),
      statCheck: undefined,
    });
    expect(JSON.stringify(hiddenProcessSupplied)).not.toMatch(
      /internal|process|reserve|exposure|checkpointCount|critical-c:physiology/i,
    );
    expect(projectCriticalPhysiologyForGm(partlyControlled)).toMatchObject({
      careState: "partly_controlled",
      exposureMilliseconds: 300_000,
      kind: "gm",
      processId: process.id,
    });
  });

  it("shows exact Difficulty when a player Health roll is legitimately due", () => {
    const physiology = createCriticalPhysiologyEvaluation({
      process: criticalInjuryFixtureC.physiologyProcesses[0]!,
      startedAt: START,
      terminalPolicy: { kind: "content_defined_terminal" },
    });
    const shock = createCriticalShockEvaluation({
      functionRecord: criticalInjuryFixtureC.functionStates[0]!,
      impactAt: START,
      mandatoryTraumaBand: "restricted",
      structuralFloor: "restricted",
    });
    const firstShockRequest = getCriticalShockCheckpoint({ at: at(30_000), evaluation: shock })!;
    const classifiedShock = resolveCriticalShockCheckpoint({
      at: at(30_000),
      currentConstitution: 12,
      evaluation: shock,
      request: firstShockRequest,
      roll: { dieResult: 8, openEndedD10s: [], rollD20: 8 },
    }).evaluation;

    const upcoming = projectCriticalInjuryForPlayer({
      allowedActionsByBand: ALLOWED_ACTIONS,
      at: at(500_000),
      careState: "not_controlled",
      injuryCase: criticalInjuryFixtureC,
      physiology,
      revealPhysiologyCheckpoint: true,
      shock: classifiedShock,
    });
    expect(upcoming.nextMeaningfulCheckpoint).toBe(at(600_000));
    expect(upcoming.statCheck).toBeUndefined();

    const projection = projectCriticalInjuryForPlayer({
      allowedActionsByBand: ALLOWED_ACTIONS,
      at: at(600_000),
      careState: "not_controlled",
      injuryCase: criticalInjuryFixtureC,
      physiology,
      revealPhysiologyCheckpoint: true,
      shock: classifiedShock,
    });

    expect(projection.statCheck).toEqual({
      difficulty: 20,
      label: "Health Stat check",
      numberToHit: "Difficulty 20",
      stat: "Health",
    });
    expect(JSON.stringify(projection)).not.toContain("DC");
  });

  it("removes cleared shock scheduling while structural floors still govern presentation", () => {
    const base = createCriticalShockEvaluation({
      functionRecord: criticalInjuryFixtureB.functionStates[0]!,
      impactAt: START,
      mandatoryTraumaBand: "no_action",
      structuralFloor: "restricted",
    });
    const classificationRequest = getCriticalShockCheckpoint({
      at: at(30_000),
      evaluation: base,
    })!;
    const restricted = resolveCriticalShockCheckpoint({
      at: at(30_000),
      currentConstitution: 12,
      evaluation: base,
      request: classificationRequest,
      roll: { dieResult: 8, openEndedD10s: [], rollD20: 8 },
    }).evaluation;
    const recoveryRequest = getCriticalShockCheckpoint({
      at: at(630_000),
      evaluation: restricted,
    })!;
    const cleared = resolveCriticalShockCheckpoint({
      at: at(630_000),
      currentConstitution: 12,
      evaluation: restricted,
      request: recoveryRequest,
      roll: { dieResult: 8, openEndedD10s: [], rollD20: 8 },
    }).evaluation;

    const projection = projectCriticalInjuryForPlayer({
      allowedActionsByBand: ALLOWED_ACTIONS,
      at: at(1_230_000),
      careState: "not_controlled",
      injuryCase: criticalInjuryFixtureB,
      shock: cleared,
    });

    expect(cleared.shockBand).toBe("functioning");
    expect(projection).toMatchObject({
      allowedActions: ["Move carefully", "Speak"],
      condition: "Impaired",
      nextMeaningfulCheckpoint: undefined,
      statCheck: undefined,
    });
  });

  it("uses the small condition vocabulary and explicit allowed actions", () => {
    const shock = createCriticalShockEvaluation({
      functionRecord: criticalInjuryFixtureB.functionStates[0]!,
      impactAt: START,
      mandatoryTraumaBand: "no_action",
    });
    const projection = projectCriticalInjuryForPlayer({
      allowedActionsByBand: ALLOWED_ACTIONS,
      at: START,
      careState: "not_controlled",
      injuryCase: criticalInjuryFixtureB,
      shock,
    });
    expect(projection.condition).toBe("No action");
    expect(projection.allowedActions).toEqual([]);
  });

  it("shows exact risk only when observable or revealed and never recommends strategy", () => {
    expect(
      projectObservableCriticalRisk({ currentStat: 12, difficulty: 23, revealed: false }),
    ).toBeUndefined();
    expect(
      projectObservableCriticalRisk({ currentStat: 12, difficulty: 23, revealed: true }),
    ).toEqual({
      successProbability: 0.5,
    });
    const revealed = JSON.stringify(
      projectObservableCriticalRisk({ currentStat: 12, difficulty: 23, revealed: true }),
    );
    expect(revealed).not.toMatch(/recommend|should|best|strategy/i);
  });
});

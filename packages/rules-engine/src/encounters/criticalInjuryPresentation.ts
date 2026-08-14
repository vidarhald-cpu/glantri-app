import type { CriticalInjuryCase } from "@glantri/domain";

import {
  getCriticalPhysiologyCheckpoint,
  getCriticalStatCheckSuccessProbability,
  getEffectiveCriticalFunctionBand,
  type CriticalCareState,
  type CriticalFunctionBand,
  type CriticalPhysiologyEvaluation,
  type CriticalShockEvaluation,
  type CriticalStatCheckRequest,
} from "./criticalInjuryEvaluator";

export interface CriticalPlayerPresentation {
  readonly allowedActions: readonly string[];
  readonly careState: CriticalCareState;
  readonly condition?: "Impaired" | "No action" | "Unconscious";
  readonly immediateEffects: readonly string[];
  readonly injury: readonly string[];
  readonly nextMeaningfulCheckpoint?: string;
  readonly statCheck?: {
    readonly difficulty: number;
    readonly label: string;
    readonly numberToHit: string;
    readonly stat: "Constitution" | "Health";
  };
}

export interface CriticalGmEvaluationProjection {
  readonly adverseTransitions: number;
  readonly careState: CriticalCareState;
  readonly checkpointCount: number;
  readonly exposureMilliseconds: number;
  readonly kind: "gm";
  readonly processId: string;
  readonly reserve?: number;
  readonly terminal: CriticalPhysiologyEvaluation["terminal"];
}

function playerCondition(band: CriticalFunctionBand): CriticalPlayerPresentation["condition"] {
  switch (band) {
    case "functioning":
      return undefined;
    case "restricted":
    case "severely_impaired":
      return "Impaired";
    case "no_action":
      return "No action";
    case "unconscious":
      return "Unconscious";
  }
}

function safeStatCheck(
  request: CriticalStatCheckRequest | undefined,
): CriticalPlayerPresentation["statCheck"] {
  if (!request) return undefined;
  return {
    difficulty: request.difficulty,
    label: `${request.stat === "health" ? "Health" : "Constitution"} Stat check`,
    numberToHit: request.numberToHit,
    stat: request.stat === "health" ? "Health" : "Constitution",
  };
}

/** GM/system projection retains canonical evaluator truth. */
export function projectCriticalPhysiologyForGm(
  evaluation: CriticalPhysiologyEvaluation,
): CriticalGmEvaluationProjection {
  return {
    adverseTransitions: evaluation.adverseTransitions,
    careState: evaluation.careState,
    checkpointCount: evaluation.checkpointResults.length,
    exposureMilliseconds: evaluation.exposureMilliseconds,
    kind: "gm",
    processId: evaluation.process.id,
    reserve: evaluation.reserve,
    terminal: evaluation.terminal,
  };
}

/**
 * Fail-closed player projection. A hidden physiology process is simply not supplied here;
 * the stable shape exposes neither hidden-process existence nor hidden record/count metadata.
 */
export function projectCriticalInjuryForPlayer(input: {
  allowedActionsByBand: Readonly<Record<CriticalFunctionBand, readonly string[]>>;
  at: string;
  careState: CriticalCareState;
  injuryCase: Readonly<CriticalInjuryCase>;
  physiology?: CriticalPhysiologyEvaluation;
  revealPhysiologyCheckpoint?: boolean;
  shock: CriticalShockEvaluation;
}): CriticalPlayerPresentation {
  const band = getEffectiveCriticalFunctionBand(input.shock);
  const physiologyCheckpoint =
    input.physiology && input.revealPhysiologyCheckpoint
      ? getCriticalPhysiologyCheckpoint({ at: input.at, evaluation: input.physiology }).request
      : undefined;
  const shockCheckpoint =
    Date.parse(input.at) >= Date.parse(input.shock.nextCheckpointAt)
      ? {
          checkpointId: "player-safe-shock-checkpoint",
          difficulty: 20,
          dueAt: input.shock.nextCheckpointAt,
          kind: "stat_check" as const,
          numberToHit: "Difficulty 20",
          stat: "constitution" as const,
        }
      : undefined;
  const request = shockCheckpoint ?? physiologyCheckpoint;

  return {
    allowedActions: input.allowedActionsByBand[band],
    careState: input.careState,
    condition: playerCondition(band),
    immediateEffects: input.injuryCase.operationalEffects
      .filter((effect) => effect.visibility === "observable")
      .map((effect) => effect.label),
    injury: input.injuryCase.injuries
      .filter((injury) => injury.visibility === "observable")
      .map((injury) => injury.label),
    nextMeaningfulCheckpoint: request?.dueAt,
    statCheck: safeStatCheck(request),
  };
}

export function projectObservableCriticalRisk(input: {
  currentStat: number;
  difficulty: number;
  revealed: boolean;
}): { successProbability: number } | undefined {
  return input.revealed
    ? {
        successProbability: getCriticalStatCheckSuccessProbability({
          currentStat: input.currentStat,
          difficulty: input.difficulty,
        }),
      }
    : undefined;
}

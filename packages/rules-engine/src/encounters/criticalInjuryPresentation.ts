import type { CriticalInjuryCase } from "@glantri/domain";

import {
  getCriticalPhysiologyCheckpoint,
  getCriticalShockCheckpoint,
  getCriticalStatCheckSuccessProbability,
  getEffectiveCriticalFunctionBand,
  getNextCriticalPhysiologyCheckpointAt,
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

interface PlayerVisibleCheckpoint {
  readonly dueAt: string;
  readonly request?: CriticalStatCheckRequest;
}

function selectNextVisibleCheckpoint(
  checkpoints: readonly (PlayerVisibleCheckpoint | undefined)[],
): PlayerVisibleCheckpoint | undefined {
  return checkpoints
    .filter((checkpoint): checkpoint is PlayerVisibleCheckpoint => checkpoint != null)
    .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt))[0];
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
  const physiologyCheckpointAt =
    input.physiology && input.revealPhysiologyCheckpoint
      ? getNextCriticalPhysiologyCheckpointAt({ at: input.at, evaluation: input.physiology })
      : undefined;
  const shockCheckpoint = getCriticalShockCheckpoint({ at: input.at, evaluation: input.shock });
  const nextCheckpoint = selectNextVisibleCheckpoint([
    input.shock.shockBand === "functioning"
      ? undefined
      : {
          dueAt: input.shock.nextCheckpointAt,
          request: shockCheckpoint,
        },
    physiologyCheckpointAt
      ? {
          dueAt: physiologyCheckpointAt,
          request: physiologyCheckpoint,
        }
      : undefined,
  ]);

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
    nextMeaningfulCheckpoint: nextCheckpoint?.dueAt,
    statCheck: safeStatCheck(nextCheckpoint?.request),
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

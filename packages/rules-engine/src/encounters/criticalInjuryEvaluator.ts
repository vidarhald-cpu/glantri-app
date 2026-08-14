import type {
  CriticalFunctionState,
  CriticalPhysiologyProcess,
  OpenEndedD20Roll,
} from "@glantri/domain";

export const CRITICAL_PLAYTEST_MILLISECONDS = {
  catastrophicUncontrolledCadence: 30_000,
  ordinarySeriousCadence: 5 * 60_000,
  secureControlWork: 2 * 60_000,
  seriousInternalCadence: 10 * 60_000,
  shockFirstCheckpoint: 30_000,
  shockRecoveryCadence: 10 * 60_000,
} as const;

export type CriticalStat = "constitution" | "health";

export interface CriticalStatCheckRequest {
  readonly checkpointId: string;
  readonly difficulty: number;
  readonly dueAt: string;
  readonly kind: "stat_check";
  readonly numberToHit: string;
  readonly stat: CriticalStat;
}

export interface CriticalStatCheckResult {
  readonly checkedAt: string;
  readonly checkpointId: string;
  readonly currentStat: number;
  readonly difficulty: number;
  readonly kind: "stat_check_result";
  readonly numberToHit: string;
  readonly roll: Readonly<OpenEndedD20Roll>;
  readonly stat: CriticalStat;
  readonly success: boolean;
  readonly total: number;
}

function assertFiniteInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be a finite integer.`);
  }
}

function parseTime(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }
  return timestamp;
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function evaluateCriticalStatCheck(input: {
  currentStat: number;
  difficulty: number;
  roll: Readonly<OpenEndedD20Roll>;
}): Pick<
  CriticalStatCheckResult,
  "currentStat" | "difficulty" | "numberToHit" | "roll" | "success" | "total"
> {
  assertFiniteInteger(input.currentStat, "Current Stat");
  assertFiniteInteger(input.difficulty, "Difficulty");
  assertFiniteInteger(input.roll.dieResult, "Open-ended d20 result");
  const total = input.currentStat + input.roll.dieResult;

  return {
    currentStat: input.currentStat,
    difficulty: input.difficulty,
    numberToHit: `Difficulty ${input.difficulty}`,
    roll: input.roll,
    success: total >= input.difficulty,
    total,
  };
}

function openEndedD10TailProbability(minimum: number): number {
  if (minimum <= 1) return 1;
  const completeTens = Math.floor((minimum - 1) / 10);
  const remainder = minimum - completeTens * 10;
  const qualifyingTerminalFaces = Math.max(0, 10 - remainder);
  return (qualifyingTerminalFaces + 1) * 10 ** -(completeTens + 1);
}

/** Exact chance that the existing open-ended d20 result plus Current Stat meets Difficulty. */
export function getCriticalStatCheckSuccessProbability(input: {
  currentStat: number;
  difficulty: number;
}): number {
  assertFiniteInteger(input.currentStat, "Current Stat");
  assertFiniteInteger(input.difficulty, "Difficulty");
  const requiredDieResult = input.difficulty - input.currentStat;

  if (requiredDieResult > 20) {
    return 0.05 * openEndedD10TailProbability(requiredDieResult - 20);
  }

  if (requiredDieResult >= 2) {
    const ordinarySuccesses = Math.max(0, 20 - requiredDieResult);
    return (ordinarySuccesses + 1) / 20;
  }

  if (requiredDieResult === 1) return 0.95;

  const downwardRollMaximum = 1 - requiredDieResult;
  const downwardSuccessProbability = 1 - openEndedD10TailProbability(downwardRollMaximum + 1);
  return 0.95 + 0.05 * downwardSuccessProbability;
}

export type CriticalCareState =
  | "not_controlled"
  | "partly_controlled"
  | "maintained_pressure"
  | "secure";

export type CriticalTerminalPolicy =
  | { readonly kind: "fatal_at_impact" }
  | { readonly kind: "dying_with_deadline"; readonly windowMilliseconds?: number }
  | { readonly kind: "content_defined_terminal" };

export type CriticalTerminalState =
  | {
      readonly dead: true;
      readonly invokedAt: string;
      readonly kind: "fatal_at_impact";
    }
  | {
      readonly deadlineAt: string;
      readonly dead: false;
      readonly invokedAt: string;
      readonly kind: "dying_with_deadline";
    }
  | {
      readonly dead: false;
      readonly invokedAt: string;
      readonly kind: "content_defined_terminal";
    };

export type CriticalPhysiologyCondition =
  | "threatened"
  | "deteriorating"
  | "critical"
  | "failing"
  | "calibration_limit";

export interface CriticalPhysiologyEvaluation {
  readonly adverseTransitions: number;
  readonly careState: CriticalCareState;
  readonly checkpointResults: readonly CriticalStatCheckResult[];
  readonly condition: CriticalPhysiologyCondition;
  readonly effectiveWorkStartedAt?: string;
  readonly exposureMilliseconds: number;
  readonly lastEvaluatedAt: string;
  readonly process: Readonly<CriticalPhysiologyProcess>;
  readonly reserve?: number;
  readonly terminal?: CriticalTerminalState;
  readonly terminalPolicy: CriticalTerminalPolicy;
}

function cadenceForProcess(process: Readonly<CriticalPhysiologyProcess>): number {
  switch (process.processClass) {
    case "ordinary_serious":
      return CRITICAL_PLAYTEST_MILLISECONDS.ordinarySeriousCadence;
    case "serious_internal":
      return CRITICAL_PLAYTEST_MILLISECONDS.seriousInternalCadence;
    case "catastrophic":
      return CRITICAL_PLAYTEST_MILLISECONDS.catastrophicUncontrolledCadence;
  }
}

function exposureRate(careState: CriticalCareState): number {
  switch (careState) {
    case "not_controlled":
      return 1;
    case "partly_controlled":
      return 0.5;
    case "maintained_pressure":
    case "secure":
      return 0;
  }
}

function invokeTerminalPolicy(
  policy: CriticalTerminalPolicy,
  invokedAt: string,
): CriticalTerminalState {
  switch (policy.kind) {
    case "fatal_at_impact":
      return { dead: true, invokedAt, kind: "fatal_at_impact" };
    case "dying_with_deadline": {
      const windowMilliseconds = policy.windowMilliseconds ?? 30_000;
      if (!Number.isFinite(windowMilliseconds) || windowMilliseconds <= 0) {
        throw new Error("A dying deadline window must be positive.");
      }
      return {
        dead: false,
        deadlineAt: toIso(parseTime(invokedAt, "Terminal invocation") + windowMilliseconds),
        invokedAt,
        kind: "dying_with_deadline",
      };
    }
    case "content_defined_terminal":
      return { dead: false, invokedAt, kind: "content_defined_terminal" };
  }
}

export function createCriticalPhysiologyEvaluation(input: {
  process: Readonly<CriticalPhysiologyProcess>;
  reserve?: 2 | 3 | 4;
  startedAt: string;
  terminalPolicy: CriticalTerminalPolicy;
}): CriticalPhysiologyEvaluation {
  const startedAt = toIso(parseTime(input.startedAt, "Physiology start"));
  const catastrophic = input.process.processClass === "catastrophic";
  if (!catastrophic && input.reserve != null) {
    throw new Error("Reserve is owned only by catastrophic physiology.");
  }

  return {
    adverseTransitions: 0,
    careState: "not_controlled",
    checkpointResults: [],
    condition: "threatened",
    exposureMilliseconds: 0,
    lastEvaluatedAt: startedAt,
    process: input.process,
    reserve: catastrophic ? (input.reserve ?? 3) : undefined,
    terminal:
      input.terminalPolicy.kind === "fatal_at_impact"
        ? invokeTerminalPolicy(input.terminalPolicy, startedAt)
        : undefined,
    terminalPolicy: input.terminalPolicy,
  };
}

function advancePhysiologyExposure(
  evaluation: CriticalPhysiologyEvaluation,
  evaluatedAt: string,
): CriticalPhysiologyEvaluation {
  const from = parseTime(evaluation.lastEvaluatedAt, "Last physiology evaluation");
  const to = parseTime(evaluatedAt, "Physiology evaluation");
  if (to < from) throw new Error("Physiology evaluation cannot move backwards in time.");

  const cadence = cadenceForProcess(evaluation.process);
  const accrued = (to - from) * exposureRate(evaluation.careState);
  return {
    ...evaluation,
    exposureMilliseconds: Math.min(cadence, evaluation.exposureMilliseconds + accrued),
    lastEvaluatedAt: toIso(to),
  };
}

export function changeCriticalCareState(input: {
  at: string;
  careState: CriticalCareState;
  evaluation: CriticalPhysiologyEvaluation;
}): CriticalPhysiologyEvaluation {
  const advanced = advancePhysiologyExposure(input.evaluation, input.at);
  if (input.careState === "secure") {
    if (
      advanced.careState !== "maintained_pressure" ||
      advanced.effectiveWorkStartedAt == null ||
      parseTime(input.at, "Care change") -
        parseTime(advanced.effectiveWorkStartedAt, "Effective work start") <
        CRITICAL_PLAYTEST_MILLISECONDS.secureControlWork
    ) {
      throw new Error("Secure control requires two minutes of continued effective work.");
    }
  }

  return {
    ...advanced,
    careState: input.careState,
    effectiveWorkStartedAt:
      input.careState === "maintained_pressure"
        ? advanced.careState === "maintained_pressure"
          ? advanced.effectiveWorkStartedAt
          : toIso(parseTime(input.at, "Care change"))
        : undefined,
  };
}

export function getCriticalPhysiologyCheckpoint(input: {
  at: string;
  evaluation: CriticalPhysiologyEvaluation;
}): { evaluation: CriticalPhysiologyEvaluation; request?: CriticalStatCheckRequest } {
  const evaluation = advancePhysiologyExposure(input.evaluation, input.at);
  const cadence = cadenceForProcess(evaluation.process);
  const ordinaryCalibrationComplete =
    evaluation.process.processClass !== "catastrophic" && evaluation.adverseTransitions >= 4;
  if (
    evaluation.terminal ||
    ordinaryCalibrationComplete ||
    evaluation.exposureMilliseconds < cadence
  ) {
    return { evaluation };
  }

  const checkpointNumber = evaluation.checkpointResults.length + 1;
  const difficulty = evaluation.process.processClass === "catastrophic" ? 23 : 20;
  return {
    evaluation,
    request: {
      checkpointId: `${evaluation.process.id}:health:${checkpointNumber}`,
      difficulty,
      dueAt: evaluation.lastEvaluatedAt,
      kind: "stat_check",
      numberToHit: `Difficulty ${difficulty}`,
      stat: "health",
    },
  };
}

function nextOrdinaryCondition(adverseTransitions: number): CriticalPhysiologyCondition {
  return (["threatened", "deteriorating", "critical", "failing", "calibration_limit"] as const)[
    Math.min(adverseTransitions, 4)
  ]!;
}

export function resolveCriticalPhysiologyCheckpoint(input: {
  at: string;
  currentHealth: number;
  evaluation: CriticalPhysiologyEvaluation;
  request: CriticalStatCheckRequest;
  roll: Readonly<OpenEndedD20Roll>;
}): { evaluation: CriticalPhysiologyEvaluation; result: CriticalStatCheckResult } {
  const cached = input.evaluation.checkpointResults.find(
    (result) => result.checkpointId === input.request.checkpointId,
  );
  if (cached) return { evaluation: input.evaluation, result: cached };

  const due = getCriticalPhysiologyCheckpoint({ at: input.at, evaluation: input.evaluation });
  if (!due.request || due.request.checkpointId !== input.request.checkpointId) {
    throw new Error("The declared physiology checkpoint is not due.");
  }

  const checked = evaluateCriticalStatCheck({
    currentStat: input.currentHealth,
    difficulty: due.request.difficulty,
    roll: input.roll,
  });
  const result: CriticalStatCheckResult = {
    ...checked,
    checkedAt: toIso(parseTime(input.at, "Physiology check")),
    checkpointId: due.request.checkpointId,
    kind: "stat_check_result",
    stat: "health",
  };
  const failure = !result.success;
  const adverseTransitions = due.evaluation.adverseTransitions + (failure ? 1 : 0);
  const catastrophic = due.evaluation.process.processClass === "catastrophic";
  const reserve = catastrophic
    ? Math.max(0, (due.evaluation.reserve ?? 3) - (failure ? 1 : 0))
    : undefined;
  const terminal =
    catastrophic && reserve === 0 && due.evaluation.terminal == null
      ? invokeTerminalPolicy(due.evaluation.terminalPolicy, result.checkedAt)
      : due.evaluation.terminal;

  return {
    evaluation: {
      ...due.evaluation,
      adverseTransitions,
      checkpointResults: [...due.evaluation.checkpointResults, result],
      condition: catastrophic
        ? terminal
          ? "calibration_limit"
          : due.evaluation.condition
        : nextOrdinaryCondition(adverseTransitions),
      exposureMilliseconds: 0,
      reserve,
      terminal,
    },
    result,
  };
}

export function getNextCriticalPhysiologyCheckpointAt(input: {
  at: string;
  evaluation: CriticalPhysiologyEvaluation;
}): string | undefined {
  const evaluation = advancePhysiologyExposure(input.evaluation, input.at);
  if (evaluation.terminal) return undefined;
  const rate = exposureRate(evaluation.careState);
  if (rate === 0) return undefined;
  const remaining = cadenceForProcess(evaluation.process) - evaluation.exposureMilliseconds;
  return toIso(parseTime(evaluation.lastEvaluatedAt, "Physiology evaluation") + remaining / rate);
}

export type CriticalFunctionBand =
  | "functioning"
  | "restricted"
  | "severely_impaired"
  | "no_action"
  | "unconscious";

export interface CriticalShockEvaluation {
  readonly authoredMinimumUntil?: string;
  readonly checkpointResults: readonly CriticalStatCheckResult[];
  readonly firstCheckpointAt: string;
  readonly functionRecord: Readonly<CriticalFunctionState>;
  readonly mandatoryTraumaBand: CriticalFunctionBand;
  readonly physiologyFloor: CriticalFunctionBand;
  readonly shockBand: "mandatory_trauma" | "severely_impaired" | "restricted" | "functioning";
  readonly structuralFloor: CriticalFunctionBand;
  readonly nextCheckpointAt: string;
}

const FUNCTION_BAND_RANK: Record<CriticalFunctionBand, number> = {
  functioning: 0,
  restricted: 1,
  severely_impaired: 2,
  no_action: 3,
  unconscious: 4,
};

function moreRestrictiveBand(...bands: CriticalFunctionBand[]): CriticalFunctionBand {
  return bands.reduce((current, candidate) =>
    FUNCTION_BAND_RANK[candidate] > FUNCTION_BAND_RANK[current] ? candidate : current,
  );
}

export function createCriticalShockEvaluation(input: {
  authoredMinimumUntil?: string;
  functionRecord: Readonly<CriticalFunctionState>;
  impactAt: string;
  mandatoryTraumaBand: CriticalFunctionBand;
  physiologyFloor?: CriticalFunctionBand;
  structuralFloor?: CriticalFunctionBand;
}): CriticalShockEvaluation {
  const impactAt = parseTime(input.impactAt, "Shock impact");
  const authoredMinimumUntil = input.authoredMinimumUntil
    ? parseTime(input.authoredMinimumUntil, "Authored trauma minimum")
    : undefined;
  const firstCheckpoint = Math.max(
    impactAt + CRITICAL_PLAYTEST_MILLISECONDS.shockFirstCheckpoint,
    authoredMinimumUntil ?? Number.NEGATIVE_INFINITY,
  );

  return {
    authoredMinimumUntil: input.authoredMinimumUntil ? toIso(authoredMinimumUntil!) : undefined,
    checkpointResults: [],
    firstCheckpointAt: toIso(firstCheckpoint),
    functionRecord: input.functionRecord,
    mandatoryTraumaBand: input.mandatoryTraumaBand,
    physiologyFloor: input.physiologyFloor ?? "functioning",
    shockBand: "mandatory_trauma",
    structuralFloor: input.structuralFloor ?? "functioning",
    nextCheckpointAt: toIso(firstCheckpoint),
  };
}

export function getCriticalShockCheckpoint(input: {
  at: string;
  evaluation: CriticalShockEvaluation;
}): CriticalStatCheckRequest | undefined {
  if (input.evaluation.shockBand === "functioning") {
    return undefined;
  }
  if (
    parseTime(input.at, "Shock evaluation") <
    parseTime(input.evaluation.nextCheckpointAt, "Shock checkpoint")
  ) {
    return undefined;
  }
  const checkpointNumber = input.evaluation.checkpointResults.length + 1;
  return {
    checkpointId: `${input.evaluation.functionRecord.id}:constitution:${checkpointNumber}`,
    difficulty: 20,
    dueAt: input.evaluation.nextCheckpointAt,
    kind: "stat_check",
    numberToHit: "Difficulty 20",
    stat: "constitution",
  };
}

function improveShockBand(
  band: CriticalShockEvaluation["shockBand"],
): CriticalShockEvaluation["shockBand"] {
  if (band === "severely_impaired") return "restricted";
  if (band === "restricted") return "functioning";
  return band;
}

export function resolveCriticalShockCheckpoint(input: {
  at: string;
  currentConstitution: number;
  evaluation: CriticalShockEvaluation;
  request: CriticalStatCheckRequest;
  roll: Readonly<OpenEndedD20Roll>;
}): { evaluation: CriticalShockEvaluation; result: CriticalStatCheckResult } {
  const cached = input.evaluation.checkpointResults.find(
    (result) => result.checkpointId === input.request.checkpointId,
  );
  if (cached) return { evaluation: input.evaluation, result: cached };

  const due = getCriticalShockCheckpoint({ at: input.at, evaluation: input.evaluation });
  if (!due || due.checkpointId !== input.request.checkpointId) {
    throw new Error("The declared shock checkpoint is not due.");
  }
  const checked = evaluateCriticalStatCheck({
    currentStat: input.currentConstitution,
    difficulty: 20,
    roll: input.roll,
  });
  const result: CriticalStatCheckResult = {
    ...checked,
    checkedAt: toIso(parseTime(input.at, "Shock check")),
    checkpointId: due.checkpointId,
    kind: "stat_check_result",
    stat: "constitution",
  };
  const initialClassification = input.evaluation.shockBand === "mandatory_trauma";
  const shockBand = initialClassification
    ? result.success
      ? "restricted"
      : "severely_impaired"
    : result.success
      ? improveShockBand(input.evaluation.shockBand)
      : input.evaluation.shockBand;

  return {
    evaluation: {
      ...input.evaluation,
      checkpointResults: [...input.evaluation.checkpointResults, result],
      nextCheckpointAt: toIso(
        parseTime(result.checkedAt, "Shock check") +
          CRITICAL_PLAYTEST_MILLISECONDS.shockRecoveryCadence,
      ),
      shockBand,
    },
    result,
  };
}

export function getEffectiveCriticalFunctionBand(
  evaluation: CriticalShockEvaluation,
): CriticalFunctionBand {
  const shockBand: CriticalFunctionBand =
    evaluation.shockBand === "mandatory_trauma"
      ? evaluation.mandatoryTraumaBand
      : evaluation.shockBand;
  return moreRestrictiveBand(shockBand, evaluation.structuralFloor, evaluation.physiologyFloor);
}

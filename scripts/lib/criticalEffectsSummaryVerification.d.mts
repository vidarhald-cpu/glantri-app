export interface CriticalEffectsSummaryRecord {
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface CriticalEffectsSummaryComparison {
  actual: unknown;
  bucket: string;
  expected: number;
  matches: boolean;
  section: string;
  sourceCell: string;
}

export interface CriticalEffectsSummaryVerification {
  comparisons: readonly CriticalEffectsSummaryComparison[];
  declaredBreakdowns: number;
  discrepancies: readonly CriticalEffectsSummaryComparison[];
  matchesPayload: boolean;
}

export function buildCriticalEffectsSummaryExpectations(
  results: readonly Record<string, unknown>[],
  effects: readonly Record<string, unknown>[],
): Map<string, number>;

export function verifyCriticalEffectsSummaryBreakdowns(input: {
  effects: readonly Record<string, unknown>[];
  results: readonly Record<string, unknown>[];
  summaryRows: readonly CriticalEffectsSummaryRecord[];
}): CriticalEffectsSummaryVerification;

export function formatCriticalEffectsSummaryDiscrepancies(
  verification: CriticalEffectsSummaryVerification,
): string;

export function assertCriticalEffectsSummaryMatches(
  verification: CriticalEffectsSummaryVerification,
): void;

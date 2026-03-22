export interface CalculateAdjustedStatsInput {
  baseStats: Record<string, number>;
  modifiers?: Record<string, number>;
}

export function calculateAdjustedStats(
  input: CalculateAdjustedStatsInput
): Record<string, number> {
  const result: Record<string, number> = { ...input.baseStats };

  for (const [stat, value] of Object.entries(input.modifiers ?? {})) {
    result[stat] = (result[stat] ?? 0) + value;
  }

  return result;
}

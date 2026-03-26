export interface CalculateGroupLevelInput {
  ranks: number;
  gms?: number;
}

export function calculateGroupLevel(input: CalculateGroupLevelInput): number {
  return input.ranks + (input.gms ?? 0);
}

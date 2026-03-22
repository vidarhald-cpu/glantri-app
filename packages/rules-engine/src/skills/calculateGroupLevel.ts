export interface CalculateGroupLevelInput {
  ranks: number;
  gms?: number;
  educationBonus?: number;
}

export function calculateGroupLevel(input: CalculateGroupLevelInput): number {
  return input.ranks + (input.gms ?? 0) + (input.educationBonus ?? 0);
}

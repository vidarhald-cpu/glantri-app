export interface CalculateGmsInput {
  ranks: number;
  statBonus?: number;
  professionBonus?: number;
}

export function calculateGms(input: CalculateGmsInput): number {
  return input.ranks + (input.statBonus ?? 0) + (input.professionBonus ?? 0);
}

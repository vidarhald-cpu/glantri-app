export interface CalculateDBInput {
  dex: number;
  shieldBonus: number;
  situationalModifier?: number;
}

export function calculateDB(input: CalculateDBInput): number {
  return input.dex + input.shieldBonus + (input.situationalModifier ?? 0);
}

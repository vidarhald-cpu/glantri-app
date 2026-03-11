export interface CalculateDBInput {
  agility: number;
  shieldBonus: number;
  situationalModifier?: number;
}

export function calculateDB(input: CalculateDBInput): number {
  return input.agility + input.shieldBonus + (input.situationalModifier ?? 0);
}

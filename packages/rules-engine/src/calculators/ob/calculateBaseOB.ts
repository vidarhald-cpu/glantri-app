export interface CalculateBaseOBInput {
  skill: number;
  weaponBonus: number;
  situationalModifier?: number;
}

export function calculateBaseOB(input: CalculateBaseOBInput): number {
  return input.skill + input.weaponBonus + (input.situationalModifier ?? 0);
}

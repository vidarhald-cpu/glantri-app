export interface CalculateSkillLevelInput {
  ranks: number;
  groupLevel: number;
  gms?: number;
}

export function calculateSkillLevel(input: CalculateSkillLevelInput): number {
  return input.groupLevel + input.ranks + (input.gms ?? 0);
}

export interface CalculateSpecializationLevelInput {
  groupLevel: number;
  specializationLevel: number;
}

export function calculateSpecializationLevel(
  input: CalculateSpecializationLevelInput
): number {
  return Math.floor(input.groupLevel / 2) + input.specializationLevel;
}

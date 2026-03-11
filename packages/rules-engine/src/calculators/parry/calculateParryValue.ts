export interface CalculateParryValueInput {
  allocatedOb: number;
  parryModifier?: number;
}

export function calculateParryValue(input: CalculateParryValueInput): number {
  return input.allocatedOb + (input.parryModifier ?? 0);
}

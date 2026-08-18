export function formatObservationContestDifference(difference: number): string {
  if (difference > 0) return `Won by ${difference}`;
  if (difference < 0) return `Lost by ${Math.abs(difference)}`;
  return "Tied";
}

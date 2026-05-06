export function formatEncumbranceDisplay(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return Number(value.toFixed(2)).toString();
}

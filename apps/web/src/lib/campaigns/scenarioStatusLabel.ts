/** Human-facing label for a Scenario lifecycle status; never show the raw enum value. */
export function formatScenarioStatus(status: string): string {
  if (status === "live") {
    return "Active";
  }

  if (status === "completed") {
    return "Closed";
  }

  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

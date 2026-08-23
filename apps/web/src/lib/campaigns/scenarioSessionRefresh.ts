import type { ScenarioSessionView } from "@glantri/domain";

export function shouldAcceptScenarioSessionResponse(
  current: ScenarioSessionView | undefined,
  incoming: ScenarioSessionView,
): boolean {
  if (!current) return true;
  return incoming.revision >= current.revision;
}

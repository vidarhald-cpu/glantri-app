import type { ScenarioParticipant } from "@glantri/domain";

function isOverrideCurrent(override: ScenarioParticipant, fetched: ScenarioParticipant): boolean {
  const overrideTime = Date.parse(override.updatedAt);
  const fetchedTime = Date.parse(fetched.updatedAt);

  if (Number.isNaN(overrideTime) || Number.isNaN(fetchedTime)) {
    return true;
  }

  return overrideTime >= fetchedTime;
}

/**
 * The GM's own mutation echo (override) beats a lagging fetched row, but a fetched row with a
 * strictly newer `updatedAt` is the later server state and wins. Unparsable timestamps keep the
 * override.
 */
export function resolveEffectiveScenarioParticipants(
  scenarioParticipants: ScenarioParticipant[],
  overrides: Record<string, ScenarioParticipant>,
): ScenarioParticipant[] {
  return scenarioParticipants.map((participant) => {
    const override = overrides[participant.id];

    return override && isOverrideCurrent(override, participant) ? override : participant;
  });
}

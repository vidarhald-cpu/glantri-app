import type { Scenario } from "../campaign/scenario";

export interface JoinableScenarioRecord {
  campaignId: string;
  campaignName: string;
  kind: Scenario["kind"];
  scenarioId: string;
  scenarioName: string;
  status: Scenario["status"];
}

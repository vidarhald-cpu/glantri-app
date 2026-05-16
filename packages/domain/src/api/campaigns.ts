import type { Campaign, Scenario } from "../campaign/scenario";

export interface AccessibleCampaignRecord {
  campaign: Campaign;
  scenarios: Scenario[];
}

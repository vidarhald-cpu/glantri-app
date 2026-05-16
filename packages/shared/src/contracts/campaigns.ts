import type { Campaign, Scenario } from "@glantri/domain";

export interface AccessibleCampaignRecord {
  campaign: Campaign;
  scenarios: Scenario[];
}

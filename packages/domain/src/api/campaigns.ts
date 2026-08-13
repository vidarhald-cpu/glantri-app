import type { EncounterStatus } from "../encounter/session";

export interface PlayerAccessibleCampaign {
  description: string;
  id: string;
  name: string;
}

export interface PlayerAccessibleScenario {
  campaignId: string;
  description: string;
  id: string;
  name: string;
}

export interface AccessibleCampaignRecord {
  campaign: PlayerAccessibleCampaign;
  scenarios: PlayerAccessibleScenario[];
}

export interface PlayerCampaignCharacterSummary {
  id: string;
  name: string;
}

export interface PlayerCampaignEncounterSummary {
  id: string;
  status: EncounterStatus;
  title: string;
}

export interface PlayerCampaignHomeScenario {
  characters: PlayerCampaignCharacterSummary[];
  encounter?: PlayerCampaignEncounterSummary;
  scenario: PlayerAccessibleScenario;
}

export interface PlayerCampaignResumeTarget {
  encounterId?: string;
  scenarioId?: string;
  tab: "campaign" | "encounter" | "player-combat" | "scenario";
}

export interface PlayerCampaignHomeRecord {
  campaign: PlayerAccessibleCampaign;
  characters: PlayerCampaignCharacterSummary[];
  resume: PlayerCampaignResumeTarget;
  scenarios: PlayerCampaignHomeScenario[];
}

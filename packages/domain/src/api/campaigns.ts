import { z } from "zod";

import type { ScenarioStatus } from "../campaign/scenario";
import type { EncounterStatus } from "../encounter/session";

export const campaignCharacterRosterCandidateSchema = z
  .object({
    alreadyRostered: z.boolean(),
    currentElsewhere: z.boolean().optional(),
    id: z.string().min(1),
    name: z.string().min(1),
    ownerLabel: z.string().min(1),
    membershipState: z.enum(["current", "former", "none"]).optional(),
  })
  .strict();

export type CampaignCharacterRosterCandidate = z.infer<
  typeof campaignCharacterRosterCandidateSchema
>;

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
  status: ScenarioStatus;
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

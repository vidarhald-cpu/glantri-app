import { z } from "zod";

import { campaignRosterEntrySchema, campaignSchema, scenarioStatusSchema } from "./scenario";
import { encounterStatusSchema } from "../encounter/session";

const idSchema = z.string().min(1);
const timestampSchema = z.string().min(1);

export const campaignNoteStatusSchema = z.enum(["open", "resolved"]);
export const campaignNoteRevisionSchema = z.string().datetime();
export const campaignNoteReferenceTypeSchema = z.enum([
  "campaign",
  "scenario",
  "encounter",
  "character",
  "npc",
  "artifact",
]);

export const campaignNoteReferenceSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
    type: campaignNoteReferenceTypeSchema,
  })
  .strict();

export const campaignNoteSchema = z
  .object({
    campaignId: idSchema,
    content: z.string().trim().min(1).max(4_000),
    createdAt: timestampSchema,
    createdByUserId: idSchema,
    id: idSchema,
    reference: campaignNoteReferenceSchema.optional(),
    resolvedAt: timestampSchema.optional(),
    resolvedByUserId: idSchema.optional(),
    status: campaignNoteStatusSchema,
    updatedAt: timestampSchema,
    updatedByUserId: idSchema,
  })
  .strict();

export const campaignCurrentEncounterSchema = z
  .object({
    activeCombat: z.boolean(),
    id: idSchema,
    status: encounterStatusSchema,
    title: z.string().min(1),
    updatedAt: timestampSchema,
  })
  .strict();

export const campaignCurrentContextSchema = z
  .object({
    encounters: z.array(campaignCurrentEncounterSchema),
    scenario: z
      .object({
        id: idSchema,
        name: z.string().min(1),
        status: scenarioStatusSchema,
        updatedAt: timestampSchema,
      })
      .strict(),
  })
  .strict();

export const campaignRecentActivitySchema = z
  .object({
    createdAt: timestampSchema,
    encounterId: idSchema.optional(),
    encounterTitle: z.string().min(1).optional(),
    eventType: z.string().min(1),
    id: idSchema,
    scenarioId: idSchema,
    scenarioName: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict();

export const campaignNpcSummarySchema = z
  .object({
    historical: z.boolean(),
    id: idSchema,
    label: z.string().min(1),
    prominent: z.boolean(),
    scenarioIds: z.array(idSchema),
  })
  .strict();

export const campaignWorkspaceOverviewSchema = z
  .object({
    campaign: campaignSchema,
    currentContexts: z.array(campaignCurrentContextSchema),
    notes: z.array(campaignNoteSchema),
    npcs: z.array(campaignNpcSummarySchema),
    recentActivity: z.array(campaignRecentActivitySchema),
    references: z.array(campaignNoteReferenceSchema),
    roster: z.array(campaignRosterEntrySchema),
  })
  .strict();

export type CampaignNoteStatus = z.infer<typeof campaignNoteStatusSchema>;
export type CampaignNoteReferenceType = z.infer<typeof campaignNoteReferenceTypeSchema>;
export type CampaignNoteReference = z.infer<typeof campaignNoteReferenceSchema>;
export type CampaignNote = z.infer<typeof campaignNoteSchema>;
export type CampaignCurrentEncounter = z.infer<typeof campaignCurrentEncounterSchema>;
export type CampaignCurrentContext = z.infer<typeof campaignCurrentContextSchema>;
export type CampaignRecentActivity = z.infer<typeof campaignRecentActivitySchema>;
export type CampaignNpcSummary = z.infer<typeof campaignNpcSummarySchema>;
export type CampaignWorkspaceOverview = z.infer<typeof campaignWorkspaceOverviewSchema>;

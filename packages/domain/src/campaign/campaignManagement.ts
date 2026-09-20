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
  "tag",
]);

/**
 * Notes stay lightweight Campaign working material rather than a general
 * task-management system, so a single Note carries a bounded set of associations.
 */
export const campaignNoteAssociationLimit = 25;
export const campaignNoteTagLabelMaxLength = 40;

export const campaignNoteReferenceSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
    /**
     * Owning Scenario for an `encounter` reference, so the Campaign index can link
     * to the Encounter's canonical home without repeating the Scenario lookup.
     */
    scenarioId: idSchema.optional(),
    type: campaignNoteReferenceTypeSchema,
  })
  .strict();

/**
 * A Note association references an existing Campaign object, or names a custom tag.
 * Associations are references only and never transfer ownership.
 */
export const campaignNoteAssociationSchema = campaignNoteReferenceSchema;

export type CampaignNoteReference = z.infer<typeof campaignNoteReferenceSchema>;

export function normalizeCampaignNoteTagLabel(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, campaignNoteTagLabelMaxLength);
}

export function campaignNoteTagId(label: string): string {
  return normalizeCampaignNoteTagLabel(label).toLocaleLowerCase();
}

export function campaignNoteAssociationKey(association: {
  id: string;
  type: CampaignNoteReferenceType;
}): string {
  return `${association.type}:${association.id}`;
}

export const campaignNoteAssociationsSchema = z
  .array(campaignNoteAssociationSchema)
  .max(campaignNoteAssociationLimit)
  .superRefine((associations, context) => {
    const seen = new Set<string>();
    for (const association of associations) {
      const key = campaignNoteAssociationKey(association);
      if (seen.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Campaign Note associations must be distinct.",
        });
        return;
      }
      seen.add(key);
    }
  });

export const campaignNoteSchema = z
  .object({
    /**
     * Every association on this Note. A legacy single-reference Note surfaces its
     * stored reference here too, so existing Notes remain readable.
     */
    associations: campaignNoteAssociationsSchema,
    campaignId: idSchema,
    content: z.string().trim().min(1).max(4_000),
    createdAt: timestampSchema,
    createdByUserId: idSchema,
    id: idSchema,
    /**
     * Legacy single reference, retained for backward compatibility with stored
     * Notes and existing readers. `associations` is authoritative.
     */
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
    /** Custom tags already used by this Campaign's Notes, offered as reuse suggestions. */
    tags: z.array(campaignNoteAssociationSchema),
  })
  .strict();

export type CampaignNoteStatus = z.infer<typeof campaignNoteStatusSchema>;
export type CampaignNoteReferenceType = z.infer<typeof campaignNoteReferenceTypeSchema>;
export type CampaignNoteAssociation = CampaignNoteReference;
export type CampaignNote = z.infer<typeof campaignNoteSchema>;
export type CampaignCurrentEncounter = z.infer<typeof campaignCurrentEncounterSchema>;
export type CampaignCurrentContext = z.infer<typeof campaignCurrentContextSchema>;
export type CampaignRecentActivity = z.infer<typeof campaignRecentActivitySchema>;
export type CampaignNpcSummary = z.infer<typeof campaignNpcSummarySchema>;
export type CampaignWorkspaceOverview = z.infer<typeof campaignWorkspaceOverviewSchema>;

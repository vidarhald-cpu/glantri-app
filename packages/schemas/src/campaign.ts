import { z } from "zod";

const idSchema = z.string().min(1);
const timestampSchema = z.string().min(1);

export const scenarioVisibilitySchema = z.enum(["hidden", "visible_to_all", "gm_only"]);
export const campaignStatusSchema = z.enum(["draft", "active", "archived"]);
export const scenarioKindSchema = z.enum(["combat", "social", "travel", "mixed"]);
export const scenarioStatusSchema = z.enum([
  "draft",
  "prepared",
  "live",
  "completed",
  "archived"
]);
export const scenarioCombatStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "paused",
  "ended"
]);
export const scenarioParticipantSourceTypeSchema = z.enum(["character", "entity"]);
export const scenarioParticipantRoleSchema = z.enum([
  "player_character",
  "npc",
  "monster",
  "animal",
  "neutral",
  "ally",
  "enemy"
]);
export const scenarioParticipantJoinSourceSchema = z.enum([
  "gm_added",
  "player_joined",
  "imported_from_template"
]);
export const campaignAssetTypeSchema = z.enum(["map", "image", "document", "handout", "drawing"]);
export const reusableEntityKindSchema = z.enum(["npc", "monster", "animal"]);

export const campaignSettingsSchema = z.object({
  allowPlayerSelfJoin: z.boolean().default(false),
  defaultVisibility: scenarioVisibilitySchema.default("hidden")
});

export const campaignSchema = z.object({
  createdAt: timestampSchema,
  description: z.string().default(""),
  gmUserId: idSchema,
  id: idSchema,
  name: z.string().min(1),
  settings: campaignSettingsSchema,
  slug: z.string().min(1),
  status: campaignStatusSchema,
  updatedAt: timestampSchema
});

export const scenarioLiveStateSchema = z.object({
  combatStatus: scenarioCombatStatusSchema.default("not_started"),
  endedAt: timestampSchema.optional(),
  phase: z.union([z.literal(1), z.literal(2)]).default(1),
  roundNumber: z.number().int().positive().default(1),
  startedAt: timestampSchema.optional()
});

export const scenarioSchema = z.object({
  campaignId: idSchema,
  createdAt: timestampSchema,
  description: z.string().default(""),
  id: idSchema,
  kind: scenarioKindSchema,
  liveState: scenarioLiveStateSchema.optional(),
  mapAssetId: idSchema.optional(),
  name: z.string().min(1),
  status: scenarioStatusSchema,
  updatedAt: timestampSchema
});

export const scenarioParticipantPositionSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  zone: z.string().min(1).default("center")
});

export const scenarioParticipantModifierSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  notes: z.string().optional(),
  source: z.string().min(1).optional(),
  value: z.number()
});

export const scenarioParticipantConditionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  notes: z.string().optional(),
  severity: z.string().optional()
});

export const scenarioParticipantStateSchema = z.object({
  combat: z.object({
    currentDistanceBand: z.string().min(1).optional(),
    engaged: z.boolean().default(false),
    initiativeRoll: z.number().int().optional(),
    lastDeclaredActionId: idSchema.optional(),
    stance: z.string().min(1).optional()
  }),
  conditions: z.array(scenarioParticipantConditionSchema).default([]),
  equipment: z.object({
    carriedItemIds: z.array(idSchema).optional(),
    equippedItemIds: z.array(idSchema).optional(),
    readyItemIds: z.array(idSchema).optional()
  }),
  health: z.object({
    bleeding: z.number().int().default(0),
    currentHp: z.number().int().default(0),
    dead: z.boolean().default(false),
    maxHp: z.number().int().default(0),
    unconscious: z.boolean().default(false),
    wounds: z.number().int().default(0)
  }),
  modifiers: z.array(scenarioParticipantModifierSchema).default([]),
  resources: z.object({
    actionPoints: z.number().int().optional(),
    ammo: z.number().int().optional(),
    fatigue: z.number().int().optional()
  }),
  snapshotVersion: z.number().int().positive().default(1)
});

export const scenarioParticipantSnapshotSchema = z.object({
  build: z.unknown().optional(),
  displayName: z.string().min(1),
  entity: z
    .object({
      description: z.string().optional(),
      kind: reusableEntityKindSchema,
      name: z.string().min(1),
      notes: z.string().optional()
    })
    .optional(),
  equipmentState: z.unknown().optional(),
  sheetSummary: z.unknown().optional(),
  sourceUpdatedAt: timestampSchema.optional()
});

export const scenarioParticipantSchema = z.object({
  characterId: idSchema.optional(),
  controlledByUserId: idSchema.optional(),
  createdAt: timestampSchema,
  entityId: idSchema.optional(),
  id: idSchema,
  initiativeSlot: z.number().int().optional(),
  isActive: z.boolean().default(true),
  joinSource: scenarioParticipantJoinSourceSchema,
  position: scenarioParticipantPositionSchema.optional(),
  role: scenarioParticipantRoleSchema,
  scenarioId: idSchema,
  snapshot: scenarioParticipantSnapshotSchema,
  sourceType: scenarioParticipantSourceTypeSchema,
  state: scenarioParticipantStateSchema,
  updatedAt: timestampSchema,
  visibilityOverrides: z
    .object({
      visibility: scenarioVisibilitySchema.optional()
    })
    .optional()
});

export const campaignAssetSchema = z.object({
  campaignId: idSchema,
  createdAt: timestampSchema,
  createdByUserId: idSchema,
  description: z.string().optional(),
  id: idSchema,
  mimeType: z.string().optional(),
  storageUrl: z.string().min(1),
  title: z.string().min(1),
  type: campaignAssetTypeSchema,
  updatedAt: timestampSchema,
  visibility: scenarioVisibilitySchema
});

export const scenarioEventLogSchema = z.object({
  actorUserId: idSchema.optional(),
  createdAt: timestampSchema,
  eventType: z.string().min(1),
  id: idSchema,
  participantId: idSchema.optional(),
  payload: z.unknown().optional(),
  phase: z.union([z.literal(1), z.literal(2)]).optional(),
  roundNumber: z.number().int().positive().optional(),
  scenarioId: idSchema,
  summary: z.string().min(1)
});

export const reusableEntitySchema = z.object({
  createdAt: timestampSchema,
  description: z.string().optional(),
  gmUserId: idSchema,
  id: idSchema,
  kind: reusableEntityKindSchema,
  name: z.string().min(1),
  notes: z.string().optional(),
  snapshot: z.unknown().optional(),
  updatedAt: timestampSchema
});

export type ScenarioVisibility = z.infer<typeof scenarioVisibilitySchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type ScenarioKind = z.infer<typeof scenarioKindSchema>;
export type ScenarioStatus = z.infer<typeof scenarioStatusSchema>;
export type ScenarioCombatStatus = z.infer<typeof scenarioCombatStatusSchema>;
export type ScenarioParticipantSourceType = z.infer<typeof scenarioParticipantSourceTypeSchema>;
export type ScenarioParticipantRole = z.infer<typeof scenarioParticipantRoleSchema>;
export type ScenarioParticipantJoinSource = z.infer<typeof scenarioParticipantJoinSourceSchema>;
export type CampaignAssetType = z.infer<typeof campaignAssetTypeSchema>;
export type ReusableEntityKind = z.infer<typeof reusableEntityKindSchema>;
export type CampaignSettings = z.infer<typeof campaignSettingsSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export type ScenarioLiveState = z.infer<typeof scenarioLiveStateSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioParticipantPosition = z.infer<typeof scenarioParticipantPositionSchema>;
export type ScenarioParticipantModifier = z.infer<typeof scenarioParticipantModifierSchema>;
export type ScenarioParticipantCondition = z.infer<typeof scenarioParticipantConditionSchema>;
export type ScenarioParticipantState = z.infer<typeof scenarioParticipantStateSchema>;
export type ScenarioParticipantSnapshot = z.infer<typeof scenarioParticipantSnapshotSchema>;
export type ScenarioParticipant = z.infer<typeof scenarioParticipantSchema>;
export type CampaignAsset = z.infer<typeof campaignAssetSchema>;
export type ScenarioEventLog = z.infer<typeof scenarioEventLogSchema>;
export type ReusableEntity = z.infer<typeof reusableEntitySchema>;

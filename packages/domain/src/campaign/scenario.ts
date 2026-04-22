import { z } from "zod";

import { characterBuildSchema, type CharacterBuild } from "../character/build";

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
  settings: campaignSettingsSchema.default({
    allowPlayerSelfJoin: false,
    defaultVisibility: "hidden"
  }),
  slug: z.string().min(1),
  status: campaignStatusSchema.default("draft"),
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
  kind: scenarioKindSchema.default("mixed"),
  liveState: scenarioLiveStateSchema.optional(),
  mapAssetId: idSchema.optional(),
  name: z.string().min(1),
  status: scenarioStatusSchema.default("draft"),
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
  source: z.string().min(1).optional(),
  value: z.number(),
  notes: z.string().optional()
});

export const scenarioParticipantConditionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  severity: z.string().optional(),
  notes: z.string().optional()
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
  displayOrder: z.number().int().optional(),
  entityId: idSchema.optional(),
  factionId: z.string().min(1).optional(),
  id: idSchema,
  initiativeSlot: z.number().int().optional(),
  isActive: z.boolean().default(true),
  joinSource: scenarioParticipantJoinSourceSchema,
  position: scenarioParticipantPositionSchema.optional(),
  role: scenarioParticipantRoleSchema,
  roleTag: z.string().min(1).optional(),
  scenarioId: idSchema,
  snapshot: scenarioParticipantSnapshotSchema,
  sourceType: scenarioParticipantSourceTypeSchema,
  state: scenarioParticipantStateSchema,
  tacticalGroupId: z.string().min(1).optional(),
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

export const scenarioPlayerVisibleParticipantSchema = z.object({
  displayName: z.string().min(1),
  factionId: z.string().min(1).optional(),
  id: idSchema,
  isActive: z.boolean(),
  isControlledByPlayer: z.boolean().default(false),
  role: scenarioParticipantRoleSchema,
  sourceType: scenarioParticipantSourceTypeSchema
});

export const scenarioPlayerControlledParticipantSchema = z.object({
  build: characterBuildSchema.optional(),
  characterId: idSchema.optional(),
  conditionCount: z.number().int().nonnegative(),
  currentHp: z.number().int(),
  displayName: z.string().min(1),
  equipmentState: z.unknown().optional(),
  factionId: z.string().min(1).optional(),
  id: idSchema,
  maxHp: z.number().int().positive(),
  role: scenarioParticipantRoleSchema,
  sourceType: scenarioParticipantSourceTypeSchema
});

export const scenarioPlayerProjectionSchema = z.object({
  actionStub: z.object({
    canDeclareActions: z.boolean().default(false),
    message: z.string().min(1)
  }),
  controlledParticipant: scenarioPlayerControlledParticipantSchema.optional(),
  controlledParticipantId: idSchema.optional(),
  hasControlledParticipant: z.boolean().default(false),
  scenario: z.object({
    combatStatus: scenarioCombatStatusSchema.default("not_started"),
    description: z.string().default(""),
    id: idSchema,
    kind: scenarioKindSchema,
    name: z.string().min(1),
    phase: z.union([z.literal(1), z.literal(2)]).default(1),
    roundNumber: z.number().int().positive().default(1),
    status: scenarioStatusSchema
  }),
  visibilityMode: z.literal("all_active_participants"),
  visibleParticipants: z.array(scenarioPlayerVisibleParticipantSchema)
});

export type ScenarioVisibility = z.infer<typeof scenarioVisibilitySchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type ScenarioKind = z.infer<typeof scenarioKindSchema>;
export type ScenarioStatus = z.infer<typeof scenarioStatusSchema>;
export type ScenarioCombatStatus = z.infer<typeof scenarioCombatStatusSchema>;
export type ScenarioParticipantSourceType = z.infer<
  typeof scenarioParticipantSourceTypeSchema
>;
export type ScenarioParticipantRole = z.infer<typeof scenarioParticipantRoleSchema>;
export type ScenarioParticipantJoinSource = z.infer<
  typeof scenarioParticipantJoinSourceSchema
>;
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
export type ScenarioPlayerVisibleParticipant = z.infer<
  typeof scenarioPlayerVisibleParticipantSchema
>;
export type ScenarioPlayerControlledParticipant = z.infer<
  typeof scenarioPlayerControlledParticipantSchema
>;
export type ScenarioPlayerProjection = z.infer<typeof scenarioPlayerProjectionSchema>;

function nowIsoString(): string {
  return new Date().toISOString();
}

function clampHealth(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}

function inferHealthFromCharacter(build: CharacterBuild): ScenarioParticipantState["health"] {
  const con = build.profile.rolledStats.con ?? 0;
  const siz = build.profile.rolledStats.siz ?? 0;
  const maxHp = Math.max(1, Math.round((con + siz) / 2));

  return {
    bleeding: 0,
    currentHp: maxHp,
    dead: false,
    maxHp,
    unconscious: false,
    wounds: 0
  };
}

function inferEquipmentArrays(equipmentState: unknown): {
  carriedItemIds?: string[];
  equippedItemIds?: string[];
  readyItemIds?: string[];
} {
  if (!equipmentState || typeof equipmentState !== "object") {
    return {};
  }

  const state = equipmentState as {
    activeLoadoutByCharacterId?: Record<
      string,
      {
        activeAmmoItemIds?: string[];
        activeMissileWeaponItemId?: string | null;
        activePrimaryWeaponItemId?: string | null;
        activeSecondaryWeaponItemId?: string | null;
        readyShieldItemId?: string | null;
        wornArmorItemId?: string | null;
      }
    >;
    itemsById?: Record<string, { characterId?: string; isEquipped?: boolean }>;
  };

  const loadout = Object.values(state.activeLoadoutByCharacterId ?? {})[0];
  const equippedItemIds = Object.entries(state.itemsById ?? {})
    .filter(([, item]) => item?.isEquipped)
    .map(([itemId]) => itemId);
  const readyItemIds = [
    loadout?.wornArmorItemId,
    loadout?.readyShieldItemId,
    loadout?.activePrimaryWeaponItemId,
    loadout?.activeSecondaryWeaponItemId,
    loadout?.activeMissileWeaponItemId,
    ...(loadout?.activeAmmoItemIds ?? [])
  ].filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0);

  return {
    carriedItemIds: Object.keys(state.itemsById ?? {}),
    equippedItemIds,
    readyItemIds
  };
}

export function createScenarioLiveState(): ScenarioLiveState {
  return scenarioLiveStateSchema.parse({
    combatStatus: "not_started",
    phase: 1,
    roundNumber: 1
  });
}

export function startScenario(
  liveState: ScenarioLiveState | undefined,
  startedAt = nowIsoString()
): ScenarioLiveState {
  return scenarioLiveStateSchema.parse({
    ...(liveState ?? createScenarioLiveState()),
    combatStatus: "in_progress",
    phase: liveState?.phase ?? 1,
    roundNumber: liveState?.roundNumber ?? 1,
    startedAt
  });
}

export function advanceScenarioRound(
  liveState: ScenarioLiveState | undefined,
  nextRoundNumber?: number
): ScenarioLiveState {
  const current = scenarioLiveStateSchema.parse(liveState ?? createScenarioLiveState());

  return scenarioLiveStateSchema.parse({
    ...current,
    phase: 1,
    roundNumber: nextRoundNumber ?? current.roundNumber + 1
  });
}

export function setScenarioPhase(
  liveState: ScenarioLiveState | undefined,
  phase: 1 | 2
): ScenarioLiveState {
  const current = scenarioLiveStateSchema.parse(liveState ?? createScenarioLiveState());

  return scenarioLiveStateSchema.parse({
    ...current,
    phase
  });
}

export function createParticipantSnapshotFromCharacter(input: {
  build: CharacterBuild;
  equipmentState?: unknown;
  sheetSummary?: unknown;
  sourceUpdatedAt?: string;
}): {
  snapshot: ScenarioParticipantSnapshot;
  state: ScenarioParticipantState;
} {
  const health = inferHealthFromCharacter(input.build);

  return {
    snapshot: scenarioParticipantSnapshotSchema.parse({
      build: input.build,
      displayName: input.build.name,
      equipmentState: input.equipmentState,
      sheetSummary: input.sheetSummary,
      sourceUpdatedAt: input.sourceUpdatedAt
    }),
    state: scenarioParticipantStateSchema.parse({
      combat: {
        engaged: false
      },
      conditions: [],
      equipment: inferEquipmentArrays(input.equipmentState),
      health,
      modifiers: [],
      resources: {},
      snapshotVersion: 1
    })
  };
}

export function createParticipantSnapshotFromEntity(input: {
  entity: {
    description?: string | null;
    kind: ReusableEntityKind;
    name: string;
    notes?: string | null;
    snapshot?: unknown;
  };
  maxHp?: number;
  sourceUpdatedAt?: string;
}): {
  snapshot: ScenarioParticipantSnapshot;
  state: ScenarioParticipantState;
} {
  const maxHp = Math.max(1, input.maxHp ?? 10);

  return {
    snapshot: scenarioParticipantSnapshotSchema.parse({
      build: input.entity.snapshot ?? undefined,
      displayName: input.entity.name,
      entity: {
        description: input.entity.description ?? undefined,
        kind: input.entity.kind,
        name: input.entity.name,
        notes: input.entity.notes ?? undefined
      },
      sourceUpdatedAt: input.sourceUpdatedAt
    }),
    state: scenarioParticipantStateSchema.parse({
      combat: {
        engaged: false
      },
      conditions: [],
      equipment: {},
      health: {
        bleeding: 0,
        currentHp: clampHealth(maxHp, maxHp),
        dead: false,
        maxHp,
        unconscious: false,
        wounds: 0
      },
      modifiers: [],
      resources: {},
      snapshotVersion: 1
    })
  };
}

function isPlayerControlledScenarioParticipant(input: {
  participant: ScenarioParticipant;
  userId: string;
}): boolean {
  return (
    input.participant.isActive &&
    input.participant.role === "player_character" &&
    input.participant.controlledByUserId === input.userId
  );
}

function buildScenarioPlayerVisibleParticipants(input: {
  controlledParticipantId?: string;
  participants: ScenarioParticipant[];
}): ScenarioPlayerVisibleParticipant[] {
  return input.participants
    .filter((participant) => participant.isActive)
    .map((participant) =>
      scenarioPlayerVisibleParticipantSchema.parse({
        displayName: participant.snapshot.displayName,
        factionId: participant.factionId,
        id: participant.id,
        isActive: participant.isActive,
        isControlledByPlayer: participant.id === input.controlledParticipantId,
        role: participant.role,
        sourceType: participant.sourceType
      })
    );
}

export function buildScenarioPlayerProjection(input: {
  participants: ScenarioParticipant[];
  scenario: Scenario;
  userId: string;
}): ScenarioPlayerProjection {
  const controlledParticipant = input.participants.find((participant) =>
    isPlayerControlledScenarioParticipant({
      participant,
      userId: input.userId
    })
  );

  const visibleParticipants = controlledParticipant
    ? buildScenarioPlayerVisibleParticipants({
        controlledParticipantId: controlledParticipant.id,
        participants: input.participants
      })
    : [];

  return scenarioPlayerProjectionSchema.parse({
    actionStub: {
      canDeclareActions: false,
      message: controlledParticipant
        ? "Actions, movement, and interaction declarations will land here in the next scenario phase."
        : "Once the GM assigns you an active character in this scenario, your action controls will appear here."
    },
    controlledParticipant: controlledParticipant
      ? {
          build: controlledParticipant.snapshot.build as CharacterBuild | undefined,
          characterId: controlledParticipant.characterId,
          conditionCount: controlledParticipant.state.conditions.length,
          currentHp: controlledParticipant.state.health.currentHp,
          displayName: controlledParticipant.snapshot.displayName,
          equipmentState: controlledParticipant.snapshot.equipmentState,
          factionId: controlledParticipant.factionId,
          id: controlledParticipant.id,
          maxHp: controlledParticipant.state.health.maxHp,
          role: controlledParticipant.role,
          sourceType: controlledParticipant.sourceType
        }
      : undefined,
    controlledParticipantId: controlledParticipant?.id,
    hasControlledParticipant: Boolean(controlledParticipant),
    scenario: {
      combatStatus: input.scenario.liveState?.combatStatus ?? "not_started",
      description: input.scenario.description,
      id: input.scenario.id,
      kind: input.scenario.kind,
      name: input.scenario.name,
      phase: input.scenario.liveState?.phase ?? 1,
      roundNumber: input.scenario.liveState?.roundNumber ?? 1,
      status: input.scenario.status
    },
    visibilityMode: "all_active_participants",
    visibleParticipants
  });
}

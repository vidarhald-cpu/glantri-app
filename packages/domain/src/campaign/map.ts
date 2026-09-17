import { z } from "zod";

const idSchema = z.string().trim().min(1).max(100);
const labelSchema = z.string().trim().min(1).max(160);
const descriptionSchema = z.string().trim().max(4_000);
const coordinateSchema = z.number().finite().min(0).max(1);

export const campaignMapRoleSchema = z.enum(["world_region", "area", "tactical"]);
export const campaignMapAccessSchema = z.enum(["gm_only", "players"]);
export const campaignMapLayerVisibilitySchema = z.enum(["gm_only", "player_visible"]);
export const campaignMapMarkerKindSchema = z.enum(["annotation", "entity_reference", "map_link"]);
export const campaignMapMarkerVisibilitySchema = z.enum(["inherit", "gm_only", "player_visible"]);
export const campaignMapEntityReferenceTypeSchema = z.enum(["character", "reusable_entity"]);

export const campaignMapCreateSchema = z
  .object({
    access: campaignMapAccessSchema.default("gm_only"),
    backgroundArtifactId: idSchema.nullable().optional(),
    description: descriptionSchema.optional().default(""),
    name: labelSchema,
    role: campaignMapRoleSchema.default("area"),
  })
  .strict();

export const campaignMapMarkerInputSchema = z
  .object({
    description: descriptionSchema.optional().default(""),
    destinationMapId: idSchema.nullable().optional(),
    entityLabelSnapshot: labelSchema.nullable().optional(),
    entityReferenceId: idSchema.nullable().optional(),
    entityReferenceType: campaignMapEntityReferenceTypeSchema.nullable().optional(),
    id: idSchema,
    kind: campaignMapMarkerKindSchema,
    label: labelSchema,
    presentation: z.string().trim().min(1).max(40).default("pin"),
    sortOrder: z.number().int().min(0),
    visibility: campaignMapMarkerVisibilitySchema.default("inherit"),
    x: coordinateSchema,
    y: coordinateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const entityFields = [
      value.entityReferenceId,
      value.entityReferenceType,
      value.entityLabelSnapshot,
    ];
    const hasAllEntityFields = entityFields.every((field) => field != null);
    const hasAnyEntityField = entityFields.some((field) => field != null);
    if (value.kind === "entity_reference" && !hasAllEntityFields) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Entity markers require one supported entity reference and label snapshot.",
      });
    }
    if (value.kind !== "entity_reference" && hasAnyEntityField) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only entity markers may contain entity reference fields.",
      });
    }
    if (value.kind === "map_link" && !value.destinationMapId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Map links require a destination Map.",
      });
    }
    if (value.kind !== "map_link" && value.destinationMapId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only Map links may contain a destination Map.",
      });
    }
  });

export const campaignMapLayerInputSchema = z
  .object({
    id: idSchema,
    markers: z.array(campaignMapMarkerInputSchema).max(500),
    name: labelSchema,
    sortOrder: z.number().int().min(0),
    visibility: campaignMapLayerVisibilitySchema,
  })
  .strict();

export const campaignMapMutationSchema = z
  .object({
    access: campaignMapAccessSchema,
    backgroundArtifactId: idSchema.nullable(),
    description: descriptionSchema,
    expectedVersion: z.number().int().positive(),
    layers: z.array(campaignMapLayerInputSchema).max(100),
    name: labelSchema,
    role: campaignMapRoleSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const layerIds = new Set<string>();
    const layerOrders = new Set<number>();
    const markerIds = new Set<string>();
    for (const layer of value.layers) {
      if (layerIds.has(layer.id)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Layer ids must be unique." });
      }
      if (layerOrders.has(layer.sortOrder)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Layer order must be unique." });
      }
      layerIds.add(layer.id);
      layerOrders.add(layer.sortOrder);
      const markerOrders = new Set<number>();
      for (const marker of layer.markers) {
        if (markerIds.has(marker.id)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "Marker ids must be unique." });
        }
        if (markerOrders.has(marker.sortOrder)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Marker order within a Layer must be unique.",
          });
        }
        markerIds.add(marker.id);
        markerOrders.add(marker.sortOrder);
      }
    }
  });

export type CampaignMapRole = z.infer<typeof campaignMapRoleSchema>;
export type CampaignMapAccess = z.infer<typeof campaignMapAccessSchema>;
export type CampaignMapLayerVisibility = z.infer<typeof campaignMapLayerVisibilitySchema>;
export type CampaignMapMarkerKind = z.infer<typeof campaignMapMarkerKindSchema>;
export type CampaignMapMarkerVisibility = z.infer<typeof campaignMapMarkerVisibilitySchema>;
export type CampaignMapEntityReferenceType = z.infer<typeof campaignMapEntityReferenceTypeSchema>;
export type CampaignMapCreate = z.infer<typeof campaignMapCreateSchema>;
export type CampaignMapMutation = z.infer<typeof campaignMapMutationSchema>;
export type CampaignMapLayerInput = z.infer<typeof campaignMapLayerInputSchema>;
export type CampaignMapMarkerInput = z.infer<typeof campaignMapMarkerInputSchema>;

export interface CampaignMapSummary {
  access: CampaignMapAccess;
  description: string;
  id: string;
  name: string;
  role: CampaignMapRole;
  updatedAt: string;
}

export interface CampaignMapGmMarker extends CampaignMapMarkerInput {
  referenceStatus?: "available" | "unavailable";
}

export interface CampaignMapGmLayer extends Omit<CampaignMapLayerInput, "markers"> {
  markers: CampaignMapGmMarker[];
}

export interface CampaignMapGmDto extends Omit<CampaignMapMutation, "expectedVersion" | "layers"> {
  background?: {
    altText?: string;
    artifactId: string;
    available: boolean;
    playerCanView: boolean;
    title: string;
  };
  campaignId: string;
  createdAt: string;
  id: string;
  layers: CampaignMapGmLayer[];
  updatedAt: string;
  version: number;
}

export interface CampaignMapPlayerMarker {
  description: string;
  destinationMapId?: string;
  id: string;
  kind: CampaignMapMarkerKind;
  label: string;
  presentation: string;
  sortOrder: number;
  x: number;
  y: number;
}

export interface CampaignMapPlayerLayer {
  id: string;
  markers: CampaignMapPlayerMarker[];
  name: string;
  sortOrder: number;
}

export interface CampaignMapPlayerDto {
  background?: { altText: string; available: true };
  description: string;
  id: string;
  layers: CampaignMapPlayerLayer[];
  name: string;
  revealedMarkers: CampaignMapPlayerMarker[];
  role: CampaignMapRole;
}

export interface CampaignMapAuthoringOptions {
  artifacts: Array<{ altText?: string; id: string; title: string }>;
  entities: Array<{
    id: string;
    label: string;
    type: CampaignMapEntityReferenceType;
  }>;
  maps: Array<{ id: string; name: string }>;
}

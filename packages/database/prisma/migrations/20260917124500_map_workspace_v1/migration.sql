CREATE TYPE "CampaignMapRole" AS ENUM ('world_region', 'area', 'tactical');
CREATE TYPE "CampaignMapAccess" AS ENUM ('gm_only', 'players');
CREATE TYPE "CampaignMapLayerVisibility" AS ENUM ('gm_only', 'player_visible');
CREATE TYPE "CampaignMapMarkerKind" AS ENUM ('annotation', 'entity_reference', 'map_link');
CREATE TYPE "CampaignMapMarkerVisibility" AS ENUM ('inherit', 'gm_only', 'player_visible');
CREATE TYPE "CampaignMapEntityReferenceType" AS ENUM ('character', 'reusable_entity');

CREATE TABLE "CampaignMap" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "role" "CampaignMapRole" NOT NULL,
  "access" "CampaignMapAccess" NOT NULL DEFAULT 'gm_only',
  "backgroundArtifactId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignMap_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignMap_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 160),
  CONSTRAINT "CampaignMap_description_check" CHECK (char_length("description") <= 4000),
  CONSTRAINT "CampaignMap_version_check" CHECK ("version" > 0)
);

CREATE TABLE "CampaignMapLayer" (
  "id" TEXT NOT NULL,
  "mapId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "visibility" "CampaignMapLayerVisibility" NOT NULL DEFAULT 'gm_only',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignMapLayer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignMapLayer_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 160),
  CONSTRAINT "CampaignMapLayer_sort_order_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "CampaignMapMarker" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "mapId" TEXT NOT NULL,
  "layerId" TEXT NOT NULL,
  "kind" "CampaignMapMarkerKind" NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "presentation" TEXT NOT NULL DEFAULT 'pin',
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "visibility" "CampaignMapMarkerVisibility" NOT NULL DEFAULT 'inherit',
  "entityReferenceType" "CampaignMapEntityReferenceType",
  "entityReferenceId" TEXT,
  "entityLabelSnapshot" TEXT,
  "destinationMapId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignMapMarker_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignMapMarker_label_check" CHECK (char_length(btrim("label")) BETWEEN 1 AND 160),
  CONSTRAINT "CampaignMapMarker_description_check" CHECK (char_length("description") <= 4000),
  CONSTRAINT "CampaignMapMarker_presentation_check" CHECK (char_length(btrim("presentation")) BETWEEN 1 AND 40),
  CONSTRAINT "CampaignMapMarker_sort_order_check" CHECK ("sortOrder" >= 0),
  CONSTRAINT "CampaignMapMarker_x_check" CHECK ("x" >= 0 AND "x" <= 1),
  CONSTRAINT "CampaignMapMarker_y_check" CHECK ("y" >= 0 AND "y" <= 1),
  CONSTRAINT "CampaignMapMarker_kind_fields_check" CHECK (
    ("kind" = 'annotation' AND "entityReferenceType" IS NULL AND "entityReferenceId" IS NULL AND "entityLabelSnapshot" IS NULL AND "destinationMapId" IS NULL)
    OR
    ("kind" = 'entity_reference' AND "entityReferenceType" IS NOT NULL AND "entityReferenceId" IS NOT NULL AND char_length(btrim("entityReferenceId")) BETWEEN 1 AND 100 AND "entityLabelSnapshot" IS NOT NULL AND char_length(btrim("entityLabelSnapshot")) BETWEEN 1 AND 160 AND "destinationMapId" IS NULL)
    OR
    ("kind" = 'map_link' AND "entityReferenceType" IS NULL AND "entityReferenceId" IS NULL AND "entityLabelSnapshot" IS NULL AND "destinationMapId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "CampaignMap_campaignId_id_key" ON "CampaignMap"("campaignId", "id");
CREATE INDEX "CampaignMap_campaignId_updatedAt_idx" ON "CampaignMap"("campaignId", "updatedAt");
CREATE INDEX "CampaignMap_campaignId_backgroundArtifactId_idx" ON "CampaignMap"("campaignId", "backgroundArtifactId");

CREATE UNIQUE INDEX "CampaignMapLayer_mapId_id_key" ON "CampaignMapLayer"("mapId", "id");
CREATE UNIQUE INDEX "CampaignMapLayer_mapId_sortOrder_key" ON "CampaignMapLayer"("mapId", "sortOrder");
CREATE INDEX "CampaignMapLayer_mapId_sortOrder_idx" ON "CampaignMapLayer"("mapId", "sortOrder");

CREATE UNIQUE INDEX "CampaignMapMarker_layerId_sortOrder_key" ON "CampaignMapMarker"("layerId", "sortOrder");
CREATE INDEX "CampaignMapMarker_mapId_layerId_sortOrder_idx" ON "CampaignMapMarker"("mapId", "layerId", "sortOrder");
CREATE INDEX "CampaignMapMarker_campaignId_destinationMapId_idx" ON "CampaignMapMarker"("campaignId", "destinationMapId");
CREATE INDEX "CampaignMapMarker_entityReferenceType_entityReferenceId_idx" ON "CampaignMapMarker"("entityReferenceType", "entityReferenceId");

ALTER TABLE "CampaignMap"
  ADD CONSTRAINT "CampaignMap_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignMap"
  ADD CONSTRAINT "CampaignMap_backgroundArtifact_fkey"
  FOREIGN KEY ("campaignId", "backgroundArtifactId") REFERENCES "CampaignAsset"("campaignId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampaignMapLayer"
  ADD CONSTRAINT "CampaignMapLayer_mapId_fkey"
  FOREIGN KEY ("mapId") REFERENCES "CampaignMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignMapMarker"
  ADD CONSTRAINT "CampaignMapMarker_map_fkey"
  FOREIGN KEY ("campaignId", "mapId") REFERENCES "CampaignMap"("campaignId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignMapMarker"
  ADD CONSTRAINT "CampaignMapMarker_layer_fkey"
  FOREIGN KEY ("mapId", "layerId") REFERENCES "CampaignMapLayer"("mapId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignMapMarker"
  ADD CONSTRAINT "CampaignMapMarker_destination_fkey"
  FOREIGN KEY ("campaignId", "destinationMapId") REFERENCES "CampaignMap"("campaignId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

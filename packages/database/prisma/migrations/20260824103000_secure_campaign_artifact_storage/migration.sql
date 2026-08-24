-- Additive Campaign Artifact storage foundation. Existing CampaignAsset rows remain
-- readable by the previous application and are classified as untrusted legacy references.
ALTER TABLE "CampaignAsset"
  ADD COLUMN "artifactKind" TEXT,
  ADD COLUMN "altText" TEXT,
  ADD COLUMN "originalFilename" TEXT,
  ADD COLUMN "provenanceKind" TEXT,
  ADD COLUMN "sourceLabel" TEXT,
  ADD COLUMN "sourceUri" TEXT,
  ADD COLUMN "mediaTypeDetected" TEXT,
  ADD COLUMN "byteSize" BIGINT,
  ADD COLUMN "sha256Digest" TEXT,
  ADD COLUMN "metadataVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lifecycleState" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'gm_private',
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "storageState" TEXT NOT NULL DEFAULT 'legacy_reference',
  ADD COLUMN "storageDeletePending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "CampaignAsset"
SET "artifactKind" = CASE
  WHEN "type"::text = 'map' THEN 'map'
  WHEN "type"::text = 'image' THEN 'image'
  WHEN "type"::text = 'handout' THEN 'handout'
  WHEN "type"::text = 'document' THEN 'document'
  ELSE 'image'
END
WHERE "artifactKind" IS NULL;

CREATE UNIQUE INDEX "CampaignAsset_campaignId_id_key" ON "CampaignAsset"("campaignId", "id");
CREATE UNIQUE INDEX "Scenario_campaignId_id_key" ON "Scenario"("campaignId", "id");

ALTER TABLE "CampaignAsset"
  ADD CONSTRAINT "CampaignAsset_artifactKind_check" CHECK ("artifactKind" IN ('map', 'image', 'portrait', 'document', 'handout')),
  ADD CONSTRAINT "CampaignAsset_provenanceKind_check" CHECK ("provenanceKind" IS NULL OR "provenanceKind" IN ('user_upload', 'imported', 'generated')),
  ADD CONSTRAINT "CampaignAsset_metadataVersion_check" CHECK ("metadataVersion" >= 1),
  ADD CONSTRAINT "CampaignAsset_lifecycleState_check" CHECK ("lifecycleState" IN ('active', 'archived', 'deleted')),
  ADD CONSTRAINT "CampaignAsset_audience_check" CHECK ("audience" IN ('gm_private', 'campaign', 'scenario')),
  ADD CONSTRAINT "CampaignAsset_storageProvider_check" CHECK ("storageProvider" IN ('local', 'azure', 'legacy')),
  ADD CONSTRAINT "CampaignAsset_storageState_check" CHECK ("storageState" IN ('pending', 'ready', 'failed', 'legacy_reference', 'deleted')),
  ADD CONSTRAINT "CampaignAsset_byteSize_check" CHECK ("byteSize" IS NULL OR ("byteSize" > 0 AND "byteSize" <= 26214400)),
  ADD CONSTRAINT "CampaignAsset_sha256Digest_check" CHECK ("sha256Digest" IS NULL OR "sha256Digest" ~ '^[0-9a-f]{64}$');

CREATE TABLE "ScenarioArtifactReference" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'attached',
  "titleSnapshot" TEXT NOT NULL,
  "captionSnapshot" TEXT,
  "altTextSnapshot" TEXT,
  "sortOrder" INTEGER,
  "attachedByUserId" TEXT NOT NULL,
  "publishedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScenarioArtifactReference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScenarioArtifactReference_state_check" CHECK ("state" IN ('attached', 'published', 'withdrawn')),
  CONSTRAINT "ScenarioArtifactReference_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "ScenarioArtifactReference_scenarioId_artifactId_key"
  ON "ScenarioArtifactReference"("scenarioId", "artifactId");
CREATE INDEX "ScenarioArtifactReference_campaignId_artifactId_state_idx"
  ON "ScenarioArtifactReference"("campaignId", "artifactId", "state");
CREATE INDEX "ScenarioArtifactReference_campaignId_scenarioId_state_idx"
  ON "ScenarioArtifactReference"("campaignId", "scenarioId", "state");

ALTER TABLE "ScenarioArtifactReference"
  ADD CONSTRAINT "ScenarioArtifactReference_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ScenarioArtifactReference_campaignId_scenarioId_fkey"
    FOREIGN KEY ("campaignId", "scenarioId") REFERENCES "Scenario"("campaignId", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "ScenarioArtifactReference_campaignId_artifactId_fkey"
    FOREIGN KEY ("campaignId", "artifactId") REFERENCES "CampaignAsset"("campaignId", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "ScenarioArtifactReference_attachedByUserId_fkey"
    FOREIGN KEY ("attachedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ScenarioArtifactReference_publishedByUserId_fkey"
    FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ArtifactAuditEvent" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtifactAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ArtifactAuditEvent_action_check" CHECK ("action" IN ('upload', 'metadata_edit', 'audience_change', 'scenario_attach', 'scenario_publish', 'scenario_withdraw', 'archive', 'restore', 'delete', 'cleanup_failed', 'cleanup_completed'))
);

CREATE INDEX "ArtifactAuditEvent_campaignId_artifactId_createdAt_idx"
  ON "ArtifactAuditEvent"("campaignId", "artifactId", "createdAt");

ALTER TABLE "ArtifactAuditEvent"
  ADD CONSTRAINT "ArtifactAuditEvent_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ArtifactAuditEvent_campaignId_artifactId_fkey"
    FOREIGN KEY ("campaignId", "artifactId") REFERENCES "CampaignAsset"("campaignId", "id") ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT "ArtifactAuditEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

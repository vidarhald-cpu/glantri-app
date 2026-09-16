CREATE TABLE "ArtifactRevision" (
 "id" TEXT PRIMARY KEY, "artifactId" TEXT NOT NULL REFERENCES "CampaignAsset"("id") ON DELETE RESTRICT,
 "number" INTEGER NOT NULL, "storageProvider" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
 "mediaType" TEXT NOT NULL, "byteSize" BIGINT NOT NULL, "sha256Digest" TEXT NOT NULL,
 "originalFilename" TEXT, "note" TEXT, "actorUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ArtifactRevision_artifactId_number_key" UNIQUE ("artifactId", "number")
);
ALTER TABLE "CampaignAsset" ADD COLUMN "currentRevisionId" TEXT UNIQUE REFERENCES "ArtifactRevision"("id") ON DELETE RESTRICT;
INSERT INTO "ArtifactRevision" ("id", "artifactId", "number", "storageProvider", "storageKey", "mediaType", "byteSize", "sha256Digest", "originalFilename", "actorUserId", "createdAt")
SELECT 'initial:' || "id", "id", 1, "storageProvider", "storageKey", "mediaTypeDetected", "byteSize", "sha256Digest", "originalFilename", "createdByUserId", "createdAt"
FROM "CampaignAsset" WHERE "storageState" = 'ready' AND "lifecycleState" <> 'deleted' AND "storageProvider" IN ('local','azure') AND "storageKey" IS NOT NULL AND "mediaTypeDetected" IS NOT NULL AND "byteSize" > 0 AND "sha256Digest" IS NOT NULL;
UPDATE "CampaignAsset" SET "currentRevisionId" = 'initial:' || "id" WHERE EXISTS (SELECT 1 FROM "ArtifactRevision" r WHERE r."artifactId" = "CampaignAsset"."id");
CREATE TABLE "ArtifactImportSession" (
 "id" TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'uploading', "manifestJson" JSONB NOT NULL,
 "resourcesJson" JSONB NOT NULL DEFAULT '[]', "previewJson" JSONB, "previewToken" TEXT,
 "resultJson" JSONB, "error" TEXT, "cleanupPending" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ArtifactImportSession_campaignId_actorUserId_createdAt_idx" ON "ArtifactImportSession"("campaignId", "actorUserId", "createdAt");
CREATE TABLE "ArtifactSourceMapping" (
 "campaignId" TEXT NOT NULL, "producer" TEXT NOT NULL, "packageId" TEXT NOT NULL,
 "sourceId" TEXT NOT NULL, "artifactId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "importId" TEXT NOT NULL,
 PRIMARY KEY ("campaignId", "producer", "packageId", "sourceId"),
 FOREIGN KEY ("campaignId", "artifactId") REFERENCES "CampaignAsset"("campaignId", "id") ON DELETE RESTRICT
);
-- Extend the existing audit vocabulary; retain every historical action.
ALTER TABLE "ArtifactAuditEvent" DROP CONSTRAINT "ArtifactAuditEvent_action_check";
ALTER TABLE "ArtifactAuditEvent" ADD CONSTRAINT "ArtifactAuditEvent_action_check" CHECK ("action" IN ('upload', 'metadata_edit', 'audience_change', 'scenario_attach', 'scenario_publish', 'scenario_withdraw', 'archive', 'restore', 'delete', 'cleanup_failed', 'cleanup_completed', 'import_create', 'revision'));

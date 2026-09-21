-- AI-assisted Artifact and Item intake (#271).
--
-- Additive and backward compatible:
--   * "CampaignAsset"."gmNotes" is a new nullable column; existing readers that
--     never select it are unaffected, and it is GM-private by construction
--     because it is absent from the player-facing Artifact projection;
--   * "CampaignItemArtifactAttachment" is a new table expressing the #268
--     ruling that an Item may have Artifacts attached as its representation;
--   * no existing column, constraint, index, or enum value is dropped or narrowed.

ALTER TABLE "CampaignAsset" ADD COLUMN IF NOT EXISTS "gmNotes" TEXT;

CREATE TABLE "CampaignItemArtifactAttachment" (
  "id"               TEXT NOT NULL,
  "campaignId"       TEXT NOT NULL,
  "itemId"           TEXT NOT NULL,
  "artifactId"       TEXT NOT NULL,
  "attachedByUserId" TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignItemArtifactAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignItemArtifactAttachment_itemId_artifactId_key"
ON "CampaignItemArtifactAttachment"("itemId", "artifactId");

CREATE INDEX "CampaignItemArtifactAttachment_campaignId_artifactId_idx"
ON "CampaignItemArtifactAttachment"("campaignId", "artifactId");

CREATE INDEX "CampaignItemArtifactAttachment_campaignId_itemId_idx"
ON "CampaignItemArtifactAttachment"("campaignId", "itemId");

ALTER TABLE "CampaignItemArtifactAttachment"
ADD CONSTRAINT "CampaignItemArtifactAttachment_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignItemArtifactAttachment"
ADD CONSTRAINT "CampaignItemArtifactAttachment_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "CharacterEquipmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignItemArtifactAttachment"
ADD CONSTRAINT "CampaignItemArtifactAttachment_campaignId_artifactId_fkey"
FOREIGN KEY ("campaignId", "artifactId") REFERENCES "CampaignAsset"("campaignId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignItemArtifactAttachment"
ADD CONSTRAINT "CampaignItemArtifactAttachment_attachedByUserId_fkey"
FOREIGN KEY ("attachedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The audit trail gains the representation-attach action. Widening the allowed
-- set is additive: every previously valid action stays valid.
ALTER TABLE "ArtifactAuditEvent" DROP CONSTRAINT "ArtifactAuditEvent_action_check";
ALTER TABLE "ArtifactAuditEvent" ADD CONSTRAINT "ArtifactAuditEvent_action_check" CHECK ("action" IN ('upload', 'metadata_edit', 'audience_change', 'scenario_attach', 'scenario_publish', 'scenario_withdraw', 'archive', 'restore', 'delete', 'cleanup_failed', 'cleanup_completed', 'import_create', 'revision', 'item_representation_attach'));

-- #307: retain Item associations while adding canonical association semantics.
-- Existing rows retain their ids, actors, timestamps, and references.
CREATE UNIQUE INDEX "CharacterEquipmentItem_campaignContextId_id_key"
ON "CharacterEquipmentItem"("campaignContextId", "id");

CREATE UNIQUE INDEX "ArtifactRevision_artifactId_id_key"
ON "ArtifactRevision"("artifactId", "id");

ALTER TABLE "CampaignItemArtifactAttachment"
  ADD COLUMN "role" TEXT NOT NULL DEFAULT 'representation',
  ADD COLUMN "provenanceKind" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "provenanceRef" TEXT,
  ADD COLUMN "revisionId" TEXT,
  ADD COLUMN "disassociatedAt" TIMESTAMP(3),
  ADD COLUMN "disassociatedByUserId" TEXT;

DROP INDEX "CampaignItemArtifactAttachment_itemId_artifactId_key";

-- Distinct roles and pins may coexist. A disassociated row remains historical
-- and does not block a later association with the same tuple.
CREATE UNIQUE INDEX "CampaignItemArtifactAttachment_active_identity_key"
ON "CampaignItemArtifactAttachment"("itemId", "artifactId", "role", COALESCE("revisionId", ''))
WHERE "disassociatedAt" IS NULL;

ALTER TABLE "CampaignItemArtifactAttachment"
  ADD CONSTRAINT "CampaignItemArtifactAttachment_role_check" CHECK (length(trim("role")) > 0),
  ADD CONSTRAINT "CampaignItemArtifactAttachment_provenanceKind_check" CHECK (length(trim("provenanceKind")) > 0),
  ADD CONSTRAINT "CampaignItemArtifactAttachment_disassociation_check"
    CHECK (("disassociatedAt" IS NULL) = ("disassociatedByUserId" IS NULL));

ALTER TABLE "CampaignItemArtifactAttachment"
  DROP CONSTRAINT "CampaignItemArtifactAttachment_itemId_fkey";

-- Deferred NO ACTION is necessary for Campaign deletion: Campaign sets the
-- Item's campaignContextId NULL while cascading deletion of associations.
ALTER TABLE "CampaignItemArtifactAttachment"
  ADD CONSTRAINT "CampaignItemArtifactAttachment_campaignId_itemId_fkey"
  FOREIGN KEY ("campaignId", "itemId")
  REFERENCES "CharacterEquipmentItem"("campaignContextId", "id")
  ON DELETE CASCADE ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "CampaignItemArtifactAttachment"
  ADD CONSTRAINT "CampaignItemArtifactAttachment_artifactId_revisionId_fkey"
  FOREIGN KEY ("artifactId", "revisionId")
  REFERENCES "ArtifactRevision"("artifactId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampaignItemArtifactAttachment"
  ADD CONSTRAINT "CampaignItemArtifactAttachment_disassociatedByUserId_fkey"
  FOREIGN KEY ("disassociatedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArtifactAuditEvent" DROP CONSTRAINT "ArtifactAuditEvent_action_check";
ALTER TABLE "ArtifactAuditEvent" ADD CONSTRAINT "ArtifactAuditEvent_action_check"
CHECK ("action" IN ('upload', 'metadata_edit', 'audience_change', 'scenario_attach',
  'scenario_publish', 'scenario_withdraw', 'archive', 'restore', 'delete',
  'cleanup_failed', 'cleanup_completed', 'import_create', 'revision',
  'item_representation_attach', 'item_representation_disassociate'));

-- Additive Campaign Blackboard foundation. Existing application tables and data are unchanged.

CREATE TABLE "CampaignBlackboardEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByLabelSnapshot" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "entryVersion" INTEGER NOT NULL,
    "currentRevisionNumber" INTEGER NOT NULL,
    "stateChangedByUserId" TEXT NOT NULL,
    "stateChangedByLabelSnapshot" TEXT NOT NULL,
    "stateChangedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignBlackboardEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bb_entry_category_check" CHECK ("category" IN ('clue_fact','document_text','image_map','recap')),
    CONSTRAINT "bb_entry_state_check" CHECK ("state" IN ('published','retracted','archived')),
    CONSTRAINT "bb_entry_version_check" CHECK ("entryVersion" >= 1),
    CONSTRAINT "bb_entry_revision_check" CHECK ("currentRevisionNumber" >= 1),
    CONSTRAINT "bb_entry_actor_label_check" CHECK (char_length(btrim("createdByLabelSnapshot")) BETWEEN 1 AND 200 AND char_length(btrim("stateChangedByLabelSnapshot")) BETWEEN 1 AND 200)
);

CREATE UNIQUE INDEX "bb_entry_campaign_id_id_key" ON "CampaignBlackboardEntry"("campaignId", "id");
CREATE UNIQUE INDEX "bb_entry_campaign_id_id_category_key" ON "CampaignBlackboardEntry"("campaignId", "id", "category");
CREATE INDEX "CampaignBlackboardEntry_campaignId_state_idx" ON "CampaignBlackboardEntry"("campaignId", "state");

CREATE TABLE "CampaignBlackboardEntryRevision" (
    "campaignId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "changeKind" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorLabelSnapshot" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "clueFact" TEXT,
    "contextText" TEXT,
    "documentText" TEXT,
    "imageCaption" TEXT,
    "sourceArtifactIdSnapshot" TEXT,
    "sourceArtifactKind" TEXT,
    "sourceArtifactTitle" TEXT,
    "sourceArtifactAltText" TEXT,
    "sourceArtifactMediaType" TEXT,
    "recapText" TEXT,
    "approvedByUserId" TEXT,
    "approvedByLabelSnapshot" TEXT,
    "approvedAt" TIMESTAMP(3),
    CONSTRAINT "bb_revision_pkey" PRIMARY KEY ("campaignId", "entryId", "revisionNumber"),
    CONSTRAINT "bb_revision_number_check" CHECK ("revisionNumber" >= 1),
    CONSTRAINT "bb_revision_kind_check" CHECK ("changeKind" IN ('initial','correction','replacement','refresh')),
    CONSTRAINT "bb_revision_title_check" CHECK (char_length(btrim("title")) BETWEEN 1 AND 200),
    CONSTRAINT "bb_revision_actor_label_check" CHECK (char_length(btrim("actorLabelSnapshot")) BETWEEN 1 AND 200),
    CONSTRAINT "bb_revision_content_check" CHECK (
      ("category" = 'clue_fact' AND "clueFact" IS NOT NULL AND char_length(btrim("clueFact")) BETWEEN 1 AND 4000 AND ("contextText" IS NULL OR char_length("contextText") <= 2000) AND "documentText" IS NULL AND "imageCaption" IS NULL AND "sourceArtifactIdSnapshot" IS NULL AND "sourceArtifactKind" IS NULL AND "sourceArtifactTitle" IS NULL AND "sourceArtifactAltText" IS NULL AND "sourceArtifactMediaType" IS NULL AND "recapText" IS NULL AND "approvedByUserId" IS NULL AND "approvedByLabelSnapshot" IS NULL AND "approvedAt" IS NULL)
      OR
      ("category" = 'document_text' AND "clueFact" IS NULL AND ("contextText" IS NULL OR char_length("contextText") <= 2000) AND "documentText" IS NOT NULL AND char_length(btrim("documentText")) BETWEEN 1 AND 20000 AND "imageCaption" IS NULL AND "sourceArtifactIdSnapshot" IS NULL AND "sourceArtifactKind" IS NULL AND "sourceArtifactTitle" IS NULL AND "sourceArtifactAltText" IS NULL AND "sourceArtifactMediaType" IS NULL AND "recapText" IS NULL AND "approvedByUserId" IS NULL AND "approvedByLabelSnapshot" IS NULL AND "approvedAt" IS NULL)
      OR
      ("category" = 'image_map' AND "clueFact" IS NULL AND "contextText" IS NULL AND "documentText" IS NULL AND ("imageCaption" IS NULL OR char_length("imageCaption") <= 2000) AND "sourceArtifactIdSnapshot" IS NOT NULL AND char_length(btrim("sourceArtifactIdSnapshot")) >= 1 AND "sourceArtifactKind" IS NOT NULL AND "sourceArtifactKind" IN ('map','image') AND "sourceArtifactTitle" IS NOT NULL AND char_length(btrim("sourceArtifactTitle")) BETWEEN 1 AND 200 AND "sourceArtifactAltText" IS NOT NULL AND char_length(btrim("sourceArtifactAltText")) BETWEEN 1 AND 1000 AND "sourceArtifactMediaType" IS NOT NULL AND "sourceArtifactMediaType" IN ('image/png','image/jpeg','image/webp') AND "recapText" IS NULL AND "approvedByUserId" IS NULL AND "approvedByLabelSnapshot" IS NULL AND "approvedAt" IS NULL)
      OR
      ("category" = 'recap' AND "clueFact" IS NULL AND "contextText" IS NULL AND "documentText" IS NULL AND "imageCaption" IS NULL AND "sourceArtifactIdSnapshot" IS NULL AND "sourceArtifactKind" IS NULL AND "sourceArtifactTitle" IS NULL AND "sourceArtifactAltText" IS NULL AND "sourceArtifactMediaType" IS NULL AND "recapText" IS NOT NULL AND char_length(btrim("recapText")) BETWEEN 1 AND 20000 AND "approvedByUserId" IS NOT NULL AND "approvedByLabelSnapshot" IS NOT NULL AND char_length(btrim("approvedByLabelSnapshot")) BETWEEN 1 AND 200 AND "approvedAt" IS NOT NULL)
    )
);

CREATE INDEX "CampaignBlackboardEntryRevision_campaignId_entryId_changedAt_idx" ON "CampaignBlackboardEntryRevision"("campaignId", "entryId", "changedAt");

CREATE TABLE "CampaignBlackboardEntryEvent" (
    "campaignId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "entryVersion" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorLabelSnapshot" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisionNumber" INTEGER,
    CONSTRAINT "bb_entry_event_pkey" PRIMARY KEY ("campaignId", "entryId", "entryVersion"),
    CONSTRAINT "bb_entry_event_version_check" CHECK ("entryVersion" >= 1),
    CONSTRAINT "bb_entry_event_action_check" CHECK ("action" IN ('initial','correction','replacement','refresh','retraction','archive')),
    CONSTRAINT "bb_entry_event_revision_check" CHECK (("action" IN ('initial','correction','replacement','refresh') AND "revisionNumber" >= 1) OR ("action" IN ('retraction','archive') AND "revisionNumber" IS NULL)),
    CONSTRAINT "bb_entry_event_actor_label_check" CHECK (char_length(btrim("actorLabelSnapshot")) BETWEEN 1 AND 200)
);
CREATE INDEX "bb_entry_event_revision_idx" ON "CampaignBlackboardEntryEvent"("campaignId", "entryId", "revisionNumber");

CREATE TABLE "CampaignBlackboardArtifactSourceLink" (
    "campaignId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "artifactId" TEXT NOT NULL,
    CONSTRAINT "bb_artifact_source_link_pkey" PRIMARY KEY ("campaignId", "entryId", "revisionNumber")
);
CREATE INDEX "CampaignBlackboardArtifactSourceLink_campaignId_artifactId_idx" ON "CampaignBlackboardArtifactSourceLink"("campaignId", "artifactId");

CREATE TABLE "CampaignBlackboardDetailUnitLineage" (
    "campaignId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    CONSTRAINT "bb_unit_lineage_pkey" PRIMARY KEY ("campaignId", "entryId", "unitKey"),
    CONSTRAINT "bb_unit_lineage_key_check" CHECK (char_length(btrim("unitKey")) >= 1)
);

CREATE TABLE "CampaignBlackboardDetailUnitVersion" (
    "campaignId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "unitVersion" INTEGER NOT NULL,
    "labelSnapshot" TEXT,
    "detailText" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByLabelSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bb_unit_version_pkey" PRIMARY KEY ("campaignId", "entryId", "unitKey", "unitVersion"),
    CONSTRAINT "bb_unit_version_number_check" CHECK ("unitVersion" >= 1),
    CONSTRAINT "bb_unit_version_label_check" CHECK ("labelSnapshot" IS NULL OR char_length(btrim("labelSnapshot")) BETWEEN 1 AND 200),
    CONSTRAINT "bb_unit_version_text_check" CHECK (char_length(btrim("detailText")) BETWEEN 1 AND 4000),
    CONSTRAINT "bb_unit_version_actor_label_check" CHECK (char_length(btrim("createdByLabelSnapshot")) BETWEEN 1 AND 200)
);

CREATE TABLE "CampaignBlackboardRevisionDetailUnit" (
    "campaignId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "unitKey" TEXT NOT NULL,
    "unitVersion" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "bb_revision_unit_pkey" PRIMARY KEY ("campaignId", "entryId", "revisionNumber", "unitKey"),
    CONSTRAINT "bb_revision_unit_version_check" CHECK ("unitVersion" >= 1),
    CONSTRAINT "bb_revision_unit_sort_check" CHECK ("sortOrder" BETWEEN 0 AND 63)
);
CREATE UNIQUE INDEX "bb_revision_unit_exact_key" ON "CampaignBlackboardRevisionDetailUnit"("campaignId", "entryId", "revisionNumber", "unitKey", "unitVersion");
CREATE UNIQUE INDEX "bb_revision_unit_sort_key" ON "CampaignBlackboardRevisionDetailUnit"("campaignId", "entryId", "revisionNumber", "sortOrder");

CREATE TABLE "CampaignBlackboardDetailGrantStream" (
    "campaignId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "targetCharacterIdSnapshot" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "unitVersion" INTEGER NOT NULL,
    "liveCharacterId" TEXT,
    "state" TEXT NOT NULL,
    "streamVersion" INTEGER NOT NULL,
    "currentEntryRevisionNumber" INTEGER NOT NULL,
    CONSTRAINT "bb_grant_stream_pkey" PRIMARY KEY ("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion"),
    CONSTRAINT "bb_grant_stream_character_identity_check" CHECK ("liveCharacterId" IS NULL OR "liveCharacterId" = "targetCharacterIdSnapshot"),
    CONSTRAINT "bb_grant_stream_state_check" CHECK ("state" IN ('granted','revoked')),
    CONSTRAINT "bb_grant_stream_version_check" CHECK ("unitVersion" >= 1 AND "streamVersion" >= 1 AND "currentEntryRevisionNumber" >= 1)
);
CREATE INDEX "CampaignBlackboardDetailGrantStream_liveCharacterId_idx" ON "CampaignBlackboardDetailGrantStream"("liveCharacterId");

CREATE TABLE "CampaignBlackboardDetailGrantEvent" (
    "campaignId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "targetCharacterIdSnapshot" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "unitVersion" INTEGER NOT NULL,
    "streamVersion" INTEGER NOT NULL,
    "resultState" TEXT NOT NULL,
    "entryRevisionNumber" INTEGER NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorLabelSnapshot" TEXT NOT NULL,
    "targetCharacterLabelSnapshot" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bb_grant_event_pkey" PRIMARY KEY ("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion", "streamVersion"),
    CONSTRAINT "bb_grant_event_state_check" CHECK ("resultState" IN ('granted','revoked')),
    CONSTRAINT "bb_grant_event_version_check" CHECK ("unitVersion" >= 1 AND "streamVersion" >= 1 AND "entryRevisionNumber" >= 1),
    CONSTRAINT "bb_grant_event_label_check" CHECK (char_length(btrim("actorLabelSnapshot")) BETWEEN 1 AND 200 AND char_length(btrim("targetCharacterLabelSnapshot")) BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX "bb_grant_event_head_key" ON "CampaignBlackboardDetailGrantEvent"("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion", "streamVersion", "resultState", "entryRevisionNumber");

CREATE TABLE "CampaignBlackboardLayout" (
    "campaignId" TEXT NOT NULL,
    "layoutVersion" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignBlackboardLayout_pkey" PRIMARY KEY ("campaignId"),
    CONSTRAINT "bb_layout_version_check" CHECK ("layoutVersion" >= 0)
);

CREATE TABLE "CampaignBlackboardPlacement" (
    "campaignId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "layer" INTEGER NOT NULL,
    "groupId" TEXT,
    "rowVersion" INTEGER NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "updatedByLabelSnapshot" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bb_placement_pkey" PRIMARY KEY ("campaignId", "entryId"),
    CONSTRAINT "bb_placement_bounds_check" CHECK ("x" BETWEEN -100000 AND 100000 AND "y" BETWEEN -100000 AND 100000 AND "width" BETWEEN 120 AND 2400 AND "height" BETWEEN 80 AND 2400 AND "layer" BETWEEN 0 AND 10000),
    CONSTRAINT "bb_placement_row_version_check" CHECK ("rowVersion" >= 1),
    CONSTRAINT "bb_placement_actor_label_check" CHECK (char_length(btrim("updatedByLabelSnapshot")) BETWEEN 1 AND 200)
);
CREATE INDEX "CampaignBlackboardPlacement_campaignId_layer_entryId_idx" ON "CampaignBlackboardPlacement"("campaignId", "layer", "entryId");
CREATE INDEX "CampaignBlackboardPlacement_campaignId_groupId_idx" ON "CampaignBlackboardPlacement"("campaignId", "groupId");

ALTER TABLE "CampaignBlackboardEntry" ADD CONSTRAINT "bb_entry_campaign_fk" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardEntry" ADD CONSTRAINT "bb_entry_created_actor_fk" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardEntry" ADD CONSTRAINT "bb_entry_state_actor_fk" FOREIGN KEY ("stateChangedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "CampaignBlackboardEntryRevision" ADD CONSTRAINT "bb_revision_entry_category_fk" FOREIGN KEY ("campaignId", "entryId", "category") REFERENCES "CampaignBlackboardEntry"("campaignId", "id", "category") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardEntryRevision" ADD CONSTRAINT "bb_revision_actor_fk" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardEntryRevision" ADD CONSTRAINT "bb_revision_approver_fk" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardEntry" ADD CONSTRAINT "bb_entry_current_revision_fk" FOREIGN KEY ("campaignId", "id", "currentRevisionNumber") REFERENCES "CampaignBlackboardEntryRevision"("campaignId", "entryId", "revisionNumber") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "CampaignBlackboardEntryEvent" ADD CONSTRAINT "bb_entry_event_entry_fk" FOREIGN KEY ("campaignId", "entryId") REFERENCES "CampaignBlackboardEntry"("campaignId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardEntryEvent" ADD CONSTRAINT "bb_entry_event_actor_fk" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardEntryEvent" ADD CONSTRAINT "bb_entry_event_revision_fk" FOREIGN KEY ("campaignId", "entryId", "revisionNumber") REFERENCES "CampaignBlackboardEntryRevision"("campaignId", "entryId", "revisionNumber") ON DELETE NO ACTION ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "CampaignBlackboardArtifactSourceLink" ADD CONSTRAINT "bb_artifact_source_revision_fk" FOREIGN KEY ("campaignId", "entryId", "revisionNumber") REFERENCES "CampaignBlackboardEntryRevision"("campaignId", "entryId", "revisionNumber") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardArtifactSourceLink" ADD CONSTRAINT "bb_artifact_source_asset_fk" FOREIGN KEY ("campaignId", "artifactId") REFERENCES "CampaignAsset"("campaignId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "CampaignBlackboardDetailUnitLineage" ADD CONSTRAINT "bb_unit_lineage_entry_fk" FOREIGN KEY ("campaignId", "entryId") REFERENCES "CampaignBlackboardEntry"("campaignId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardDetailUnitVersion" ADD CONSTRAINT "bb_unit_version_lineage_fk" FOREIGN KEY ("campaignId", "entryId", "unitKey") REFERENCES "CampaignBlackboardDetailUnitLineage"("campaignId", "entryId", "unitKey") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardDetailUnitVersion" ADD CONSTRAINT "bb_unit_version_actor_fk" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardRevisionDetailUnit" ADD CONSTRAINT "bb_revision_unit_revision_fk" FOREIGN KEY ("campaignId", "entryId", "revisionNumber") REFERENCES "CampaignBlackboardEntryRevision"("campaignId", "entryId", "revisionNumber") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardRevisionDetailUnit" ADD CONSTRAINT "bb_revision_unit_version_fk" FOREIGN KEY ("campaignId", "entryId", "unitKey", "unitVersion") REFERENCES "CampaignBlackboardDetailUnitVersion"("campaignId", "entryId", "unitKey", "unitVersion") ON DELETE NO ACTION ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "CampaignBlackboardDetailGrantStream" ADD CONSTRAINT "bb_grant_stream_entry_fk" FOREIGN KEY ("campaignId", "entryId") REFERENCES "CampaignBlackboardEntry"("campaignId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardDetailGrantStream" ADD CONSTRAINT "bb_grant_stream_unit_version_fk" FOREIGN KEY ("campaignId", "entryId", "unitKey", "unitVersion") REFERENCES "CampaignBlackboardDetailUnitVersion"("campaignId", "entryId", "unitKey", "unitVersion") ON DELETE NO ACTION ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "CampaignBlackboardDetailGrantStream" ADD CONSTRAINT "bb_grant_stream_live_character_fk" FOREIGN KEY ("liveCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE "CampaignBlackboardDetailGrantEvent" ADD CONSTRAINT "bb_grant_event_stream_fk" FOREIGN KEY ("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion") REFERENCES "CampaignBlackboardDetailGrantStream"("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardDetailGrantEvent" ADD CONSTRAINT "bb_grant_event_revision_unit_fk" FOREIGN KEY ("campaignId", "entryId", "entryRevisionNumber", "unitKey", "unitVersion") REFERENCES "CampaignBlackboardRevisionDetailUnit"("campaignId", "entryId", "revisionNumber", "unitKey", "unitVersion") ON DELETE NO ACTION ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "CampaignBlackboardDetailGrantEvent" ADD CONSTRAINT "bb_grant_event_actor_fk" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardDetailGrantStream" ADD CONSTRAINT "bb_grant_stream_current_event_fk" FOREIGN KEY ("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion", "streamVersion", "state", "currentEntryRevisionNumber") REFERENCES "CampaignBlackboardDetailGrantEvent"("campaignId", "entryId", "targetCharacterIdSnapshot", "unitKey", "unitVersion", "streamVersion", "resultState", "entryRevisionNumber") ON DELETE RESTRICT ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "CampaignBlackboardLayout" ADD CONSTRAINT "bb_layout_campaign_fk" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardPlacement" ADD CONSTRAINT "bb_placement_entry_fk" FOREIGN KEY ("campaignId", "entryId") REFERENCES "CampaignBlackboardEntry"("campaignId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardPlacement" ADD CONSTRAINT "bb_placement_layout_fk" FOREIGN KEY ("campaignId") REFERENCES "CampaignBlackboardLayout"("campaignId") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardPlacement" ADD CONSTRAINT "bb_placement_actor_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

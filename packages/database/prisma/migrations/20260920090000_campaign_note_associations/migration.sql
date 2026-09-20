-- Campaign Note multi-association support (#238).
--
-- Additive and backward compatible:
--   * the legacy single-reference columns on "CampaignNote" are retained and keep
--     working, so existing Notes stay readable by existing readers;
--   * existing single references are backfilled into the new association table so
--     the new multi-association reader sees them without any data loss;
--   * no existing column, constraint, or index is dropped or narrowed.

-- Custom tags are stored as an association type alongside object references.
ALTER TYPE "CampaignNoteReferenceType" ADD VALUE IF NOT EXISTS 'tag';

CREATE TABLE "CampaignNoteAssociation" (
  "id"            TEXT NOT NULL,
  "noteId"        TEXT NOT NULL,
  "type"          "CampaignNoteReferenceType" NOT NULL,
  "targetId"      TEXT NOT NULL,
  "labelSnapshot" TEXT NOT NULL,
  "scenarioId"    TEXT,
  "position"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignNoteAssociation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignNoteAssociation_noteId_type_targetId_key"
ON "CampaignNoteAssociation"("noteId", "type", "targetId");

CREATE INDEX "CampaignNoteAssociation_noteId_position_idx"
ON "CampaignNoteAssociation"("noteId", "position");

CREATE INDEX "CampaignNoteAssociation_type_targetId_idx"
ON "CampaignNoteAssociation"("type", "targetId");

ALTER TABLE "CampaignNoteAssociation"
ADD CONSTRAINT "CampaignNoteAssociation_noteId_fkey"
FOREIGN KEY ("noteId") REFERENCES "CampaignNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: promote each existing complete single reference to one association row.
-- Notes without a stored reference simply get no association row.
INSERT INTO "CampaignNoteAssociation" (
  "id", "noteId", "type", "targetId", "labelSnapshot", "scenarioId", "position", "createdAt"
)
SELECT
  'cna_legacy_' || "CampaignNote"."id",
  "CampaignNote"."id",
  "CampaignNote"."referenceType",
  "CampaignNote"."referenceId",
  "CampaignNote"."referenceLabelSnapshot",
  NULL,
  0,
  "CampaignNote"."createdAt"
FROM "CampaignNote"
WHERE "CampaignNote"."referenceType" IS NOT NULL
  AND "CampaignNote"."referenceId" IS NOT NULL
  AND "CampaignNote"."referenceLabelSnapshot" IS NOT NULL
ON CONFLICT ("noteId", "type", "targetId") DO NOTHING;

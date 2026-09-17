-- Retain existing roster rows as current membership. Historical membership is
-- recorded only from this migration forward; no former history is fabricated.
CREATE TYPE "CampaignRosterMembershipState" AS ENUM ('current', 'former');
CREATE TYPE "CampaignNoteStatus" AS ENUM ('open', 'resolved');
CREATE TYPE "CampaignNoteReferenceType" AS ENUM (
  'campaign',
  'scenario',
  'encounter',
  'character',
  'npc',
  'artifact'
);

ALTER TABLE "CampaignRosterEntry"
ADD COLUMN "membershipState" "CampaignRosterMembershipState" NOT NULL DEFAULT 'current';

DROP INDEX "CampaignRosterEntry_one_active_campaign_per_character_key";

CREATE UNIQUE INDEX "CampaignRosterEntry_one_current_campaign_per_character_key"
ON "CampaignRosterEntry"("sourceId")
WHERE "sourceType" = 'character' AND "membershipState" = 'current';

CREATE TABLE "CampaignNote" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "CampaignNoteStatus" NOT NULL DEFAULT 'open',
  "referenceType" "CampaignNoteReferenceType",
  "referenceId" TEXT,
  "referenceLabelSnapshot" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignNote_reference_pair_check" CHECK (
    ("referenceType" IS NULL AND "referenceId" IS NULL AND "referenceLabelSnapshot" IS NULL)
    OR
    ("referenceType" IS NOT NULL AND "referenceId" IS NOT NULL AND "referenceLabelSnapshot" IS NOT NULL)
  ),
  CONSTRAINT "CampaignNote_resolution_check" CHECK (
    ("status" = 'open' AND "resolvedAt" IS NULL AND "resolvedByUserId" IS NULL)
    OR
    ("status" = 'resolved' AND "resolvedAt" IS NOT NULL AND "resolvedByUserId" IS NOT NULL)
  )
);

CREATE INDEX "CampaignNote_campaignId_status_updatedAt_idx"
ON "CampaignNote"("campaignId", "status", "updatedAt");

CREATE INDEX "CampaignNote_campaignId_referenceType_referenceId_idx"
ON "CampaignNote"("campaignId", "referenceType", "referenceId");

ALTER TABLE "CampaignNote"
ADD CONSTRAINT "CampaignNote_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

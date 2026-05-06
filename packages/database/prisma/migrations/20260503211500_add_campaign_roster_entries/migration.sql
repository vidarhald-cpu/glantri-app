CREATE TYPE "CampaignRosterSourceType" AS ENUM ('character', 'reusableEntity', 'template');

CREATE TYPE "CampaignRosterCategory" AS ENUM ('pc', 'npc', 'template');

CREATE TABLE "CampaignRosterEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sourceType" "CampaignRosterSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "category" "CampaignRosterCategory" NOT NULL,
    "labelSnapshot" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignRosterEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignRosterEntry_campaignId_idx" ON "CampaignRosterEntry"("campaignId");

CREATE INDEX "CampaignRosterEntry_sourceType_sourceId_idx" ON "CampaignRosterEntry"("sourceType", "sourceId");

CREATE UNIQUE INDEX "CampaignRosterEntry_campaignId_sourceType_sourceId_key" ON "CampaignRosterEntry"("campaignId", "sourceType", "sourceId");

ALTER TABLE "CampaignRosterEntry" ADD CONSTRAINT "CampaignRosterEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ScenarioKind" AS ENUM ('combat', 'social', 'travel', 'mixed');

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('draft', 'prepared', 'live', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "ScenarioParticipantSourceType" AS ENUM ('character', 'entity');

-- CreateEnum
CREATE TYPE "ScenarioParticipantRole" AS ENUM ('player_character', 'npc', 'monster', 'animal', 'neutral', 'ally', 'enemy');

-- CreateEnum
CREATE TYPE "ScenarioParticipantJoinSource" AS ENUM ('gm_added', 'player_joined', 'imported_from_template');

-- CreateEnum
CREATE TYPE "ScenarioVisibility" AS ENUM ('hidden', 'visible_to_all', 'gm_only');

-- CreateEnum
CREATE TYPE "CampaignAssetType" AS ENUM ('map', 'image', 'document', 'handout', 'drawing');

-- CreateEnum
CREATE TYPE "ReusableEntityKind" AS ENUM ('npc', 'monster', 'animal');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "gmUserId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "ScenarioKind" NOT NULL,
    "status" "ScenarioStatus" NOT NULL,
    "mapAssetId" TEXT,
    "liveStateJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReusableEntity" (
    "id" TEXT NOT NULL,
    "gmUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ReusableEntityKind" NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "snapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReusableEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioParticipant" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "sourceType" "ScenarioParticipantSourceType" NOT NULL,
    "characterId" TEXT,
    "entityId" TEXT,
    "role" "ScenarioParticipantRole" NOT NULL,
    "controlledByUserId" TEXT,
    "joinSource" "ScenarioParticipantJoinSource" NOT NULL,
    "initiativeSlot" INTEGER,
    "positionJson" JSONB,
    "visibilityOverridesJson" JSONB,
    "stateJson" JSONB NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAsset" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "CampaignAssetType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "visibility" "ScenarioVisibility" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioEventLog" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "roundNumber" INTEGER,
    "phase" INTEGER,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "participantId" TEXT,
    "summary" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Scenario_campaignId_idx" ON "Scenario"("campaignId");

-- CreateIndex
CREATE INDEX "Scenario_campaignId_status_idx" ON "Scenario"("campaignId", "status");

-- CreateIndex
CREATE INDEX "ReusableEntity_gmUserId_idx" ON "ReusableEntity"("gmUserId");

-- CreateIndex
CREATE INDEX "ScenarioParticipant_scenarioId_idx" ON "ScenarioParticipant"("scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioParticipant_characterId_idx" ON "ScenarioParticipant"("characterId");

-- CreateIndex
CREATE INDEX "ScenarioParticipant_entityId_idx" ON "ScenarioParticipant"("entityId");

-- CreateIndex
CREATE INDEX "ScenarioParticipant_controlledByUserId_idx" ON "ScenarioParticipant"("controlledByUserId");

-- CreateIndex
CREATE INDEX "CampaignAsset_campaignId_idx" ON "CampaignAsset"("campaignId");

-- CreateIndex
CREATE INDEX "ScenarioEventLog_scenarioId_idx" ON "ScenarioEventLog"("scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioEventLog_participantId_idx" ON "ScenarioEventLog"("participantId");

-- CreateIndex
CREATE INDEX "ScenarioEventLog_actorUserId_idx" ON "ScenarioEventLog"("actorUserId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_gmUserId_fkey" FOREIGN KEY ("gmUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_mapAssetId_fkey" FOREIGN KEY ("mapAssetId") REFERENCES "CampaignAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReusableEntity" ADD CONSTRAINT "ReusableEntity_gmUserId_fkey" FOREIGN KEY ("gmUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioParticipant" ADD CONSTRAINT "ScenarioParticipant_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioParticipant" ADD CONSTRAINT "ScenarioParticipant_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioParticipant" ADD CONSTRAINT "ScenarioParticipant_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ReusableEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioParticipant" ADD CONSTRAINT "ScenarioParticipant_controlledByUserId_fkey" FOREIGN KEY ("controlledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioEventLog" ADD CONSTRAINT "ScenarioEventLog_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioEventLog" ADD CONSTRAINT "ScenarioEventLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioEventLog" ADD CONSTRAINT "ScenarioEventLog_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ScenarioParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Encounter"
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "scenarioId" TEXT,
ADD COLUMN "sessionJson" JSONB,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'setup';

CREATE INDEX "Encounter_campaignId_idx" ON "Encounter"("campaignId");
CREATE INDEX "Encounter_scenarioId_idx" ON "Encounter"("scenarioId");
CREATE INDEX "Encounter_scenarioId_updatedAt_idx" ON "Encounter"("scenarioId", "updatedAt");

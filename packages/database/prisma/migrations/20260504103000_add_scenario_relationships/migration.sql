-- CreateEnum
CREATE TYPE "ScenarioRelationshipType" AS ENUM ('continues_from');

-- CreateTable
CREATE TABLE "ScenarioRelationship" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "fromScenarioId" TEXT NOT NULL,
    "toScenarioId" TEXT NOT NULL,
    "relationType" "ScenarioRelationshipType" NOT NULL,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScenarioRelationship_campaignId_idx" ON "ScenarioRelationship"("campaignId");

-- CreateIndex
CREATE INDEX "ScenarioRelationship_fromScenarioId_idx" ON "ScenarioRelationship"("fromScenarioId");

-- CreateIndex
CREATE INDEX "ScenarioRelationship_toScenarioId_idx" ON "ScenarioRelationship"("toScenarioId");

-- CreateIndex
CREATE INDEX "ScenarioRelationship_campaignId_relationType_idx" ON "ScenarioRelationship"("campaignId", "relationType");

-- AddForeignKey
ALTER TABLE "ScenarioRelationship" ADD CONSTRAINT "ScenarioRelationship_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioRelationship" ADD CONSTRAINT "ScenarioRelationship_fromScenarioId_fkey" FOREIGN KEY ("fromScenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioRelationship" ADD CONSTRAINT "ScenarioRelationship_toScenarioId_fkey" FOREIGN KEY ("toScenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

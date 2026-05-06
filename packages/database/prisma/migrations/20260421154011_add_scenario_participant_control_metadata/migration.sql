ALTER TABLE "ScenarioParticipant"
ADD COLUMN "factionId" TEXT,
ADD COLUMN "tacticalGroupId" TEXT,
ADD COLUMN "roleTag" TEXT,
ADD COLUMN "displayOrder" INTEGER;

CREATE INDEX "ScenarioParticipant_scenarioId_controlledByUserId_idx"
ON "ScenarioParticipant"("scenarioId", "controlledByUserId");

CREATE INDEX "ScenarioParticipant_scenarioId_factionId_idx"
ON "ScenarioParticipant"("scenarioId", "factionId");

CREATE INDEX "ScenarioParticipant_scenarioId_tacticalGroupId_idx"
ON "ScenarioParticipant"("scenarioId", "tacticalGroupId");

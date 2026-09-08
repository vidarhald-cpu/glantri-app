-- Bounded Field Equipment transition evidence. Current Item state remains in
-- CharacterEquipmentItem; these rows retain only the accepted audit facts.
CREATE TABLE "EquipmentTransitionEvent" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "itemId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorAuthority" TEXT NOT NULL,
    "campaignId" TEXT,
    "characterId" TEXT,
    "sourceCharacterId" TEXT,
    "targetCharacterId" TEXT,
    "scenarioId" TEXT,
    "encounterId" TEXT,
    "commandId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentTransitionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EquipmentTransitionEvent_sequence_key" ON "EquipmentTransitionEvent"("sequence");
CREATE INDEX "EquipmentTransitionEvent_itemId_sequence_idx" ON "EquipmentTransitionEvent"("itemId", "sequence");
CREATE INDEX "EquipmentTransitionEvent_campaignId_sequence_idx" ON "EquipmentTransitionEvent"("campaignId", "sequence");
CREATE INDEX "EquipmentTransitionEvent_characterId_sequence_idx" ON "EquipmentTransitionEvent"("characterId", "sequence");
CREATE INDEX "EquipmentTransitionEvent_scenarioId_sequence_idx" ON "EquipmentTransitionEvent"("scenarioId", "sequence");
CREATE INDEX "EquipmentTransitionEvent_encounterId_sequence_idx" ON "EquipmentTransitionEvent"("encounterId", "sequence");
CREATE INDEX "EquipmentTransitionEvent_actorUserId_sequence_idx" ON "EquipmentTransitionEvent"("actorUserId", "sequence");

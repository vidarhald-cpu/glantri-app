ALTER TABLE "Encounter"
ADD COLUMN "combatStorageMode" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "combatArchiveCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "EncounterActiveCombatState" (
    "encounterId" TEXT NOT NULL,
    "revision" TIMESTAMP(3) NOT NULL,
    "stateJson" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterActiveCombatState_pkey" PRIMARY KEY ("encounterId")
);

CREATE TABLE "EncounterArchivedCombatRound" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "roundJson" JSONB NOT NULL,
    "sourceRevision" TIMESTAMP(3) NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncounterArchivedCombatRound_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EncounterActiveCombatState_revision_idx"
ON "EncounterActiveCombatState"("revision");

CREATE UNIQUE INDEX "EncounterArchivedCombatRound_encounterId_roundNumber_key"
ON "EncounterArchivedCombatRound"("encounterId", "roundNumber");

CREATE INDEX "EncounterArchivedCombatRound_encounterId_roundNumber_idx"
ON "EncounterArchivedCombatRound"("encounterId", "roundNumber");

ALTER TABLE "EncounterActiveCombatState"
ADD CONSTRAINT "EncounterActiveCombatState_encounterId_fkey"
FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EncounterArchivedCombatRound"
ADD CONSTRAINT "EncounterArchivedCombatRound_encounterId_fkey"
FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

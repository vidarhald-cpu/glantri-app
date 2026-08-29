-- Retained Character revision, acquisition-ledger, and single-active-Campaign foundation.
ALTER TABLE "Character" ADD COLUMN "currentRetainedRevisionId" TEXT;

CREATE TABLE "CharacterRevision" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "parentRevisionId" TEXT,
    "commandIdempotencyKey" TEXT NOT NULL,
    "commandDigest" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT,
    "versionEnvelopeJson" JSONB NOT NULL,
    "stateJson" JSONB NOT NULL,
    "effectiveSkillsJson" JSONB NOT NULL,
    "revisionDigest" TEXT NOT NULL,
    "migrationLineageJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CharacterRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CharacterLedgerEvent" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "characterRevisionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "publicExplanation" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "actorUserId" TEXT,
    "visibility" TEXT NOT NULL,
    "valueBefore" INTEGER,
    "valueAfter" INTEGER,
    "valueDelta" INTEGER,
    "economicsJson" JSONB,
    "prerequisiteEvidenceJson" JSONB,
    "protectedProvenanceJson" JSONB,
    "versionEnvelopeJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CharacterLedgerEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Character_currentRetainedRevisionId_key" ON "Character"("currentRetainedRevisionId");
CREATE UNIQUE INDEX "CharacterRevision_characterId_sequence_key" ON "CharacterRevision"("characterId", "sequence");
CREATE UNIQUE INDEX "CharacterRevision_characterId_commandIdempotencyKey_key" ON "CharacterRevision"("characterId", "commandIdempotencyKey");
CREATE INDEX "CharacterRevision_characterId_createdAt_idx" ON "CharacterRevision"("characterId", "createdAt");
CREATE UNIQUE INDEX "CharacterLedgerEvent_characterRevisionId_sequence_key" ON "CharacterLedgerEvent"("characterRevisionId", "sequence");
CREATE UNIQUE INDEX "CharacterLedgerEvent_characterId_idempotencyKey_key" ON "CharacterLedgerEvent"("characterId", "idempotencyKey");
CREATE INDEX "CharacterLedgerEvent_characterId_occurredAt_idx" ON "CharacterLedgerEvent"("characterId", "occurredAt");
CREATE INDEX "CharacterLedgerEvent_targetKind_targetId_idx" ON "CharacterLedgerEvent"("targetKind", "targetId");

-- A roster row is current membership. This partial unique index makes concurrent joins to
-- different Campaigns race at PostgreSQL authority while preserving non-Character roster entries.
CREATE UNIQUE INDEX "CampaignRosterEntry_one_active_campaign_per_character_key"
ON "CampaignRosterEntry"("sourceId") WHERE "sourceType" = 'character';

ALTER TABLE "CharacterRevision" ADD CONSTRAINT "CharacterRevision_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterLedgerEvent" ADD CONSTRAINT "CharacterLedgerEvent_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterLedgerEvent" ADD CONSTRAINT "CharacterLedgerEvent_characterRevisionId_fkey"
FOREIGN KEY ("characterRevisionId") REFERENCES "CharacterRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Character" ADD CONSTRAINT "Character_currentRetainedRevisionId_fkey"
FOREIGN KEY ("currentRetainedRevisionId") REFERENCES "CharacterRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

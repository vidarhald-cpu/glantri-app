-- One revision-controlled aggregate owns the normalized current equipment
-- records for a Character. Existing rows are backfilled at revision zero so
-- their first aggregate mutation remains explicit and compatible.
CREATE TABLE "CharacterEquipmentAggregate" (
    "characterId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CharacterEquipmentAggregate_pkey" PRIMARY KEY ("characterId")
);

INSERT INTO "CharacterEquipmentAggregate" ("characterId")
SELECT "id" FROM "Character";

ALTER TABLE "CharacterEquipmentAggregate" ADD CONSTRAINT "CharacterEquipmentAggregate_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

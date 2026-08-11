-- B1 turns the existing CharacterEquipmentItem row into the durable item
-- authority. Existing IDs and assigned inventory state are preserved.

ALTER TABLE "CharacterEquipmentItem"
DROP CONSTRAINT "CharacterEquipmentItem_characterId_fkey";

DROP INDEX "CharacterEquipmentItem_characterId_idx";
DROP INDEX "CharacterEquipmentItem_characterId_locationId_idx";

ALTER TABLE "CharacterEquipmentItem"
RENAME COLUMN "characterId" TO "holderCharacterId";

ALTER TABLE "CharacterEquipmentItem"
ALTER COLUMN "holderCharacterId" DROP NOT NULL,
ALTER COLUMN "locationId" DROP NOT NULL,
ALTER COLUMN "carryMode" DROP NOT NULL,
ADD COLUMN "campaignContextId" TEXT,
ADD COLUMN "itemFactsJson" JSONB;

-- Legacy custom notes remain ordinary, non-mechanical item notes.
UPDATE "CharacterEquipmentItem"
SET "notes" = CASE
  WHEN NULLIF(BTRIM("notes"), '') IS NULL
    THEN BTRIM("specialPropertiesJson" ->> 'customNotes')
  ELSE "notes" || E'\n\n' || BTRIM("specialPropertiesJson" ->> 'customNotes')
END
WHERE JSONB_TYPEOF("specialPropertiesJson" -> 'customNotes') = 'string'
  AND NULLIF(BTRIM("specialPropertiesJson" ->> 'customNotes'), '') IS NOT NULL;

-- Legacy strings are deliberately migrated as revealed descriptive or
-- unsupported facts. They never become executable mechanics.
UPDATE "CharacterEquipmentItem" AS item
SET "itemFactsJson" = JSONB_BUILD_OBJECT(
  'version', 1,
  'templateOverrides', '[]'::JSONB,
  'activeMechanics', '[]'::JSONB,
  'descriptiveTraits', COALESCE((
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', 'legacy-roleplay-trait-' || trait.ordinality,
        'category', 'other',
        'text', trait.value,
        'visibility', 'revealed'
      )
      ORDER BY trait.ordinality
    )
    FROM JSONB_ARRAY_ELEMENTS_TEXT(
      CASE
        WHEN JSONB_TYPEOF(item."specialPropertiesJson" -> 'roleplayTraits') = 'array'
          THEN item."specialPropertiesJson" -> 'roleplayTraits'
        ELSE '[]'::JSONB
      END
    ) WITH ORDINALITY AS trait(value, ordinality)
    WHERE NULLIF(BTRIM(trait.value), '') IS NOT NULL
  ), '[]'::JSONB),
  'unsupportedCapabilities', COALESCE((
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', capability.id,
        'name', capability.name,
        'rulesText', capability.rules_text,
        'usageText', NULL,
        'visibility', 'revealed'
      )
      ORDER BY capability.group_order, capability.ordinality
    )
    FROM (
      SELECT
        'legacy-magic-capability-' || entry.ordinality AS id,
        'Legacy magic effect' AS name,
        entry.value AS rules_text,
        1 AS group_order,
        entry.ordinality
      FROM JSONB_ARRAY_ELEMENTS_TEXT(
        CASE
          WHEN JSONB_TYPEOF(item."specialPropertiesJson" -> 'magicEffects') = 'array'
            THEN item."specialPropertiesJson" -> 'magicEffects'
          ELSE '[]'::JSONB
        END
      ) WITH ORDINALITY AS entry(value, ordinality)
      WHERE NULLIF(BTRIM(entry.value), '') IS NOT NULL

      UNION ALL

      SELECT
        'legacy-damage-capability-' || entry.ordinality,
        'Legacy damage effect',
        entry.value,
        2,
        entry.ordinality
      FROM JSONB_ARRAY_ELEMENTS_TEXT(
        CASE
          WHEN JSONB_TYPEOF(item."specialPropertiesJson" -> 'damageEffects') = 'array'
            THEN item."specialPropertiesJson" -> 'damageEffects'
          ELSE '[]'::JSONB
        END
      ) WITH ORDINALITY AS entry(value, ordinality)
      WHERE NULLIF(BTRIM(entry.value), '') IS NOT NULL

      UNION ALL

      SELECT
        'legacy-protective-capability-' || entry.ordinality,
        'Legacy protective effect',
        entry.value,
        3,
        entry.ordinality
      FROM JSONB_ARRAY_ELEMENTS_TEXT(
        CASE
          WHEN JSONB_TYPEOF(item."specialPropertiesJson" -> 'protectiveEffects') = 'array'
            THEN item."specialPropertiesJson" -> 'protectiveEffects'
          ELSE '[]'::JSONB
        END
      ) WITH ORDINALITY AS entry(value, ordinality)
      WHERE NULLIF(BTRIM(entry.value), '') IS NOT NULL

      UNION ALL

      SELECT
        'legacy-utility-capability-' || entry.ordinality,
        'Legacy utility effect',
        entry.value,
        4,
        entry.ordinality
      FROM JSONB_ARRAY_ELEMENTS_TEXT(
        CASE
          WHEN JSONB_TYPEOF(item."specialPropertiesJson" -> 'utilityEffects') = 'array'
            THEN item."specialPropertiesJson" -> 'utilityEffects'
          ELSE '[]'::JSONB
        END
      ) WITH ORDINALITY AS entry(value, ordinality)
      WHERE NULLIF(BTRIM(entry.value), '') IS NOT NULL
    ) AS capability
  ), '[]'::JSONB)
);

ALTER TABLE "CharacterEquipmentItem"
ALTER COLUMN "itemFactsJson" SET NOT NULL,
DROP COLUMN "specialPropertiesJson",
ADD CONSTRAINT "CharacterEquipmentItem_itemFactsJson_version_check"
  CHECK ("itemFactsJson" ->> 'version' = '1');

CREATE INDEX "CharacterEquipmentItem_holderCharacterId_idx"
ON "CharacterEquipmentItem"("holderCharacterId");

CREATE INDEX "CharacterEquipmentItem_holderCharacterId_locationId_idx"
ON "CharacterEquipmentItem"("holderCharacterId", "locationId");

CREATE INDEX "CharacterEquipmentItem_campaignContextId_idx"
ON "CharacterEquipmentItem"("campaignContextId");

ALTER TABLE "CharacterEquipmentItem"
ADD CONSTRAINT "CharacterEquipmentItem_holderCharacterId_fkey"
FOREIGN KEY ("holderCharacterId") REFERENCES "Character"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CharacterEquipmentItem"
ADD CONSTRAINT "CharacterEquipmentItem_campaignContextId_fkey"
FOREIGN KEY ("campaignContextId") REFERENCES "Campaign"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CharacterEquipmentItem"
ADD CONSTRAINT "CharacterEquipmentItem_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "CharacterStorageLocation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Character storage assignments cannot outlive their Character-backed holder.
-- This also completes the location FK's SET NULL action by clearing carry mode.
CREATE FUNCTION "normalize_character_equipment_assignment"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."holderCharacterId" IS NULL OR NEW."locationId" IS NULL THEN
    NEW."locationId" := NULL;
    NEW."carryMode" := NULL;
    NEW."previousLocationId" := NULL;
    NEW."previousCarryMode" := NULL;
    NEW."isEquipped" := FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CharacterEquipmentItem_normalize_assignment"
BEFORE INSERT OR UPDATE OF "holderCharacterId", "locationId"
ON "CharacterEquipmentItem"
FOR EACH ROW
EXECUTE FUNCTION "normalize_character_equipment_assignment"();

-- Recovery: restore from the normal pre-deploy database backup if the data
-- checks above fail. A down migration would be lossy once unheld items exist,
-- so automatic rollback is intentionally not provided.

-- GM-private notes for canonical Items (#271 privacy repair).
--
-- "CharacterEquipmentItem"."notes" is, and remains, the player-visible
-- description/notes field: the Campaign Items surface writes the GM's
-- Description into it and the player equipment read model returns it. GM-only
-- material therefore needs a column of its own.
--
-- Additive and backward compatible:
--   * "gmNotes" is a new nullable column; on PostgreSQL 11+ a nullable
--     ADD COLUMN without a default is a metadata-only change, so existing rows
--     are untouched and keep their values;
--   * every existing reader selects explicit columns or maps an explicit
--     object, so no current projection gains the new field;
--   * no existing column, constraint, index, default or enum value is dropped,
--     narrowed or renamed.

ALTER TABLE "CharacterEquipmentItem" ADD COLUMN IF NOT EXISTS "gmNotes" TEXT;

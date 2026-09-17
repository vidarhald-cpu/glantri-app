-- Preserve all Item ids, bindings, relations and historical JSON. No data rewrite.
ALTER TABLE "CharacterEquipmentItem"
  ALTER COLUMN "templateId" DROP NOT NULL,
  ALTER COLUMN "category" DROP NOT NULL,
  ADD COLUMN "mechanicalOverridesJson" JSONB,
  ADD COLUMN "physicalBaseEncumbrance" DOUBLE PRECISION;
ALTER TABLE "CharacterEquipmentItem" ADD CONSTRAINT "item_template_binding"
  CHECK (("templateId" IS NULL) = ("category" IS NULL));

-- Every writer, including depletion and undo, advances the same CAS token even
-- when multiple writes share a millisecond. Historical payloads are untouched.
CREATE FUNCTION advance_equipment_item_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" := GREATEST(NEW."updatedAt", OLD."updatedAt" + interval '1 millisecond');
  RETURN NEW;
END;
$$;
CREATE TRIGGER equipment_item_revision BEFORE UPDATE ON "CharacterEquipmentItem"
FOR EACH ROW EXECUTE FUNCTION advance_equipment_item_revision();

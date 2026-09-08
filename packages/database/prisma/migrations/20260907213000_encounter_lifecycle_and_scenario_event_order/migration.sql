-- Normalize the common Encounter lifecycle while preserving existing records.
ALTER TABLE "Encounter" ALTER COLUMN "status" SET DEFAULT 'draft';

UPDATE "Encounter"
SET "status" = CASE
  WHEN "status" IN ('setup', 'planned') THEN 'draft'
  WHEN "status" = 'complete' THEN 'completed'
  ELSE "status"
END
WHERE "status" IN ('setup', 'planned', 'complete');

UPDATE "Encounter"
SET "sessionJson" = jsonb_set(
  "sessionJson"::jsonb,
  '{status}',
  to_jsonb(CASE
    WHEN "sessionJson"->>'status' IN ('setup', 'planned') THEN 'draft'
    WHEN "sessionJson"->>'status' = 'complete' THEN 'completed'
    ELSE "sessionJson"->>'status'
  END),
  true
)
WHERE "sessionJson"->>'status' IN ('setup', 'planned', 'complete');

-- The database assigns one immutable total order to Scenario history.
ALTER TABLE "ScenarioEventLog" ADD COLUMN "sequence" SERIAL NOT NULL;
CREATE UNIQUE INDEX "ScenarioEventLog_sequence_key" ON "ScenarioEventLog"("sequence");
CREATE INDEX "ScenarioEventLog_scenarioId_sequence_idx"
  ON "ScenarioEventLog"("scenarioId", "sequence");

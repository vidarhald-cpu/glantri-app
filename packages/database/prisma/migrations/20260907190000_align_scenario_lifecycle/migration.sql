-- The superseding Scenario lifecycle replaces the pre-play `prepared` status
-- with `draft` and adds the resumable `paused` status. `completed` remains the
-- persisted representation of the product term Closed.
ALTER TYPE "ScenarioStatus" RENAME TO "ScenarioStatus_old";

CREATE TYPE "ScenarioStatus" AS ENUM ('draft', 'live', 'paused', 'completed', 'archived');

ALTER TABLE "Scenario" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Scenario"
ALTER COLUMN "status" TYPE "ScenarioStatus"
USING (
  CASE
    WHEN "status"::text = 'prepared' THEN 'draft'
    ELSE "status"::text
  END
)::"ScenarioStatus";

ALTER TABLE "Scenario" ALTER COLUMN "status" SET DEFAULT 'draft';

DROP TYPE "ScenarioStatus_old";

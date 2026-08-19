-- Preserve whether a legacy Scenario has entered play before replacing its status values.
ALTER TABLE "Scenario"
ADD COLUMN "lifecycleRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lifecycleCycle" INTEGER NOT NULL DEFAULT 0;

UPDATE "Scenario"
SET "lifecycleCycle" = CASE
  WHEN "status"::text IN ('live', 'completed') THEN 1
  WHEN "status"::text = 'archived' AND "liveStateJson"->>'startedAt' IS NOT NULL THEN 1
  ELSE 0
END;

ALTER TYPE "ScenarioStatus" RENAME TO "ScenarioStatus_legacy";
CREATE TYPE "ScenarioStatus" AS ENUM ('draft', 'live', 'paused', 'closed', 'archived');

ALTER TABLE "Scenario"
ALTER COLUMN "status" TYPE "ScenarioStatus"
USING (
  CASE "status"::text
    WHEN 'prepared' THEN 'draft'
    WHEN 'completed' THEN 'closed'
    ELSE "status"::text
  END
)::"ScenarioStatus";

DROP TYPE "ScenarioStatus_legacy";

CREATE TABLE "ScenarioLifecycleTransition" (
  "id" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "fromStatus" "ScenarioStatus" NOT NULL,
  "toStatus" "ScenarioStatus" NOT NULL,
  "expectedRevision" INTEGER NOT NULL,
  "resultingRevision" INTEGER NOT NULL,
  "cycle" INTEGER NOT NULL,
  "transitionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ScenarioLifecycleTransition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScenarioLifecycleTransition_scenarioId_resultingRevision_key"
ON "ScenarioLifecycleTransition"("scenarioId", "resultingRevision");

CREATE INDEX "ScenarioLifecycleTransition_scenarioId_transitionedAt_idx"
ON "ScenarioLifecycleTransition"("scenarioId", "transitionedAt");

CREATE INDEX "ScenarioLifecycleTransition_actorUserId_idx"
ON "ScenarioLifecycleTransition"("actorUserId");

ALTER TABLE "ScenarioLifecycleTransition"
ADD CONSTRAINT "ScenarioLifecycleTransition_scenarioId_fkey"
FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScenarioLifecycleTransition"
ADD CONSTRAINT "ScenarioLifecycleTransition_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

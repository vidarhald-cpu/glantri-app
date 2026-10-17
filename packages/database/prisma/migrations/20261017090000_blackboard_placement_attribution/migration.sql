-- Campaign Blackboard V1 section 18.1 requires the Change Log to record
-- "card added" and "card removed". Neither was recorded: no placement
-- operation created an event row, and deletePlacement took no actor at all,
-- so the actor was unrecoverable once the placement row was gone.
--
-- These events cannot live in CampaignBlackboardEntryEvent. Its primary key is
-- ("campaignId", "entryId", "entryVersion"), no placement operation advances
-- entryVersion, and the ordinary first pin would therefore collide with the
-- `initial` row createEntry writes at a hardcoded entryVersion 1.
--
-- "layoutVersion" is the key instead, because every placement operation
-- already consumes exactly one new layoutVersion atomically through
-- advanceLayout's guarded increment, inside the operation's own transaction.
-- Gaps left by the section 18.2 operations that stay unlogged (drag, stacking,
-- grouping) are harmless and preserve ordering.
--
-- This migration is purely additive. It creates one new table with its own
-- constraints and one index. No existing table is altered, no primary key is
-- widened, no rows are backfilled and no existing read path changes.
-- Attribution is prospective: placements that already exist acquire none,
-- because inferring a pinner from
-- CampaignBlackboardPlacement."updatedByUserId" would manufacture a false
-- record -- that column is the last mutator, not the pinner.

CREATE TABLE "CampaignBlackboardPlacementEvent" (
    "campaignId" TEXT NOT NULL,
    "layoutVersion" INTEGER NOT NULL,
    "entryId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorLabelSnapshot" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bb_placement_event_pkey" PRIMARY KEY ("campaignId", "layoutVersion"),
    CONSTRAINT "bb_placement_event_layout_version_check" CHECK ("layoutVersion" >= 1),
    CONSTRAINT "bb_placement_event_action_check" CHECK ("action" IN ('card_added','card_removed')),
    CONSTRAINT "bb_placement_event_actor_label_check" CHECK (char_length(btrim("actorLabelSnapshot")) BETWEEN 1 AND 200)
);

CREATE INDEX "bb_placement_event_entry_idx" ON "CampaignBlackboardPlacementEvent"("campaignId", "entryId", "occurredAt");

-- Same referential shape as the sibling bb_entry_event_* constraints: events
-- follow their entry out of existence, and an actor who has been attributed
-- cannot be deleted out from under the record.
ALTER TABLE "CampaignBlackboardPlacementEvent" ADD CONSTRAINT "bb_placement_event_entry_fk" FOREIGN KEY ("campaignId", "entryId") REFERENCES "CampaignBlackboardEntry"("campaignId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "CampaignBlackboardPlacementEvent" ADD CONSTRAINT "bb_placement_event_actor_fk" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

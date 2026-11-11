import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND,
  combatRoundStateSchema,
  encounterSessionSchema,
  type EncounterSession,
} from "@glantri/domain";

import { getTestPrismaClient, resetTestDatabase } from "../testing/testDatabase";
import {
  CombatPersistenceError,
  createPrismaCombatStatePersistenceRepository,
} from "./combatStatePersistenceRepository";
import { createPrismaEncounterRepository } from "./encounterRepository";

// Forgejo #1136. `listScenarioSessionEncounters` is the Scenario session projections' reading of
// a Scenario's Encounters. Active ones are read in full; finished ones without their combat
// rounds, carrying only the Item actions an `item_resolution` Activity row names. Every case here
// is measured against `listEncountersByScenario`, the full reading those projections used before.

const prisma = getTestPrismaClient();
const SCENARIO_ID = "session-listing-scenario";
const AT = "2026-11-10T10:00:00.000Z";

function action(id: string, status: "active" | "completed" | "declared", intent = id) {
  return {
    createdAt: AT,
    duration: { kind: "round" },
    id,
    intent,
    lastUpdatedAt: AT,
    ownerParticipantId: "participant-0",
    preset: "item_interaction",
    progress: {},
    status,
  };
}

// A command whose payload stands for the bulk of a real archived round: the part this listing
// must not read for a finished Encounter.
function bulkyCommand(roundNumber: number) {
  const cursor = { roundNumber, step: "DE" };
  return {
    afterCursor: cursor,
    beforeCursor: cursor,
    createdAt: AT,
    facts: { previousStepSnapshots: [{ note: "x".repeat(2_000), roundNumber }] },
    id: `command-${roundNumber}`,
    participantId: "participant-0",
    roundNumber,
    type: "declare_action",
  };
}

async function seedScenario(client: PrismaClient) {
  const user = await client.user.create({
    data: { email: "session-listing@example.test", id: "session-listing-gm", passwordHash: "x" },
  });
  const campaign = await client.campaign.create({
    data: {
      description: "",
      gmUserId: user.id,
      id: "session-listing-campaign",
      name: "Session listing",
      settingsJson: {},
      slug: "session-listing-campaign",
      status: "active",
    },
  });
  await client.scenario.create({
    data: {
      campaignId: campaign.id,
      description: "",
      id: SCENARIO_ID,
      kind: "combat",
      name: "Session listing scenario",
      status: "live",
    },
  });
}

/**
 * Creates one Encounter with a combat state. Unless `legacy` is set it is then written once through
 * the combat persistence path, which stores it split, as every combat write does.
 */
async function createEncounter(
  client: PrismaClient,
  input: {
    activeActions?: ReturnType<typeof action>[];
    archivedRounds?: Array<{ actions?: ReturnType<typeof action>[] }>;
    id: string;
    legacy?: boolean;
    status: "active" | "archived" | "completed" | "paused";
  },
): Promise<EncounterSession> {
  const archivedRounds = input.archivedRounds ?? [];
  const session = encounterSessionSchema.parse({
    actionLog: [],
    combatRoundState: combatRoundStateSchema.parse({
      commands: [bulkyCommand(archivedRounds.length + 1)],
      encounterId: input.id,
      genericActions: input.activeActions ?? [],
      participants: [{ label: "Participant 0", participantId: "participant-0" }],
      roundNumber: archivedRounds.length + 1,
      rounds: archivedRounds.map((round, index) => ({
        commands: [bulkyCommand(index + 1)],
        encounterId: input.id,
        genericActions: round.actions ?? [],
        roundNumber: index + 1,
      })),
    }),
    createdAt: AT,
    currentRound: archivedRounds.length + 1,
    id: input.id,
    kind: "combat",
    participants: [
      {
        id: "participant-0",
        label: "Participant 0",
        participantType: "scenario",
        scenarioParticipantId: "scenario-participant-0",
      },
    ],
    playerOutcome: `Outcome of ${input.id}`,
    roleplayState: { visibility: { "participant-0": { "participant-1": true } } },
    scenarioId: SCENARIO_ID,
    status: input.status,
    title: `Encounter ${input.id}`,
    updatedAt: AT,
  });
  const created = await client.encounter.create({
    data: {
      id: input.id,
      name: session.title,
      scenarioId: SCENARIO_ID,
      sessionJson: session as never,
      status: input.status,
    },
  });
  if (input.legacy) return session;
  return createPrismaCombatStatePersistenceRepository(client).updateCombatEncounter({
    encounterId: input.id,
    expectedRevision: created.updatedAt.toISOString(),
    scenarioId: SCENARIO_ID,
    session,
  });
}

async function recordItemOutcome(client: PrismaClient, encounterId: string, actionId: string) {
  await client.scenarioEventLog.create({
    data: {
      eventType: "encounter_combat_outcome",
      payloadJson: {
        actionId,
        audienceParticipantIds: ["scenario-participant-0"],
        encounterId,
        eventKind: COMBAT_ACTIVITY_ITEM_RESOLUTION_EVENT_KIND,
      },
      scenarioId: SCENARIO_ID,
      summary: `Outcome of ${actionId}`,
    },
  });
}

function withoutCombat(encounter: EncounterSession | undefined) {
  if (!encounter) return encounter;
  const { combatRoundState: _combat, ...rest } = encounter;
  return rest;
}

/** The lookup `canViewCurrentItemOutcome` makes: the active state first, then archived rounds. */
function findAction(encounter: EncounterSession | undefined, actionId: string) {
  const state = encounter?.combatRoundState;
  if (!state) return undefined;
  return [state, ...state.rounds]
    .flatMap((round) => round.genericActions)
    .find((entry) => entry.id === actionId);
}

if (!process.env.DATABASE_URL_TEST) {
  describe.skip("Scenario session Encounter listing (DATABASE_URL_TEST not set)", () => {});
} else {
  describe("Scenario session Encounter listing (#1136)", () => {
    const repository = () => createPrismaEncounterRepository(prisma!);

    beforeEach(async () => {
      await resetTestDatabase(prisma!);
      await seedScenario(prisma!);
    });

    it("reads active and paused Encounters exactly as the full listing does", async () => {
      await createEncounter(prisma!, {
        activeActions: [action("live-item", "active")],
        archivedRounds: [{ actions: [action("live-item", "declared")] }, {}],
        id: "encounter-active",
        status: "active",
      });
      await createEncounter(prisma!, {
        archivedRounds: [{}],
        id: "encounter-paused",
        status: "paused",
      });

      const full = await repository().listEncountersByScenario(SCENARIO_ID);
      const session = await repository().listScenarioSessionEncounters(SCENARIO_ID);

      expect(full).toHaveLength(2);
      expect(session).toEqual(full);
    });

    it("reads a finished Encounter without combat, and keeps everything else it stores", async () => {
      await createEncounter(prisma!, {
        archivedRounds: [{ actions: [action("unnamed", "completed")] }, {}, {}],
        id: "encounter-completed",
        status: "completed",
      });
      await createEncounter(prisma!, {
        archivedRounds: [{}, {}],
        id: "encounter-archived",
        status: "archived",
      });
      await createEncounter(prisma!, { id: "encounter-active", status: "active" });

      const full = await repository().listEncountersByScenario(SCENARIO_ID);
      const session = await repository().listScenarioSessionEncounters(SCENARIO_ID);

      // Same Encounters, same order, same stored session apart from combat.
      expect(session.map((encounter) => encounter.id)).toEqual(
        full.map((encounter) => encounter.id),
      );
      expect(session.map(withoutCombat)).toEqual(full.map(withoutCombat));
      for (const id of ["encounter-completed", "encounter-archived"]) {
        const fullEncounter = full.find((encounter) => encounter.id === id)!;
        expect(fullEncounter.combatRoundState!.rounds.length).toBeGreaterThan(0);
        expect(session.find((encounter) => encounter.id === id)!.combatRoundState).toBeUndefined();
      }
      expect(session.find((encounter) => encounter.id === "encounter-active")).toEqual(
        full.find((encounter) => encounter.id === "encounter-active"),
      );
      expect(JSON.stringify(full)).toContain("previousStepSnapshots");
      expect(
        JSON.stringify(session.filter((encounter) => encounter.id !== "encounter-active")),
      ).not.toContain("previousStepSnapshots");
    });

    it("keeps exactly the Item actions an item_resolution row names, where the full state has them", async () => {
      // `carried` is resolved in round 1 and carried forward, so the active state and round 1 both
      // hold a copy with different statuses; the lookup must find the active state's copy first.
      await createEncounter(prisma!, {
        activeActions: [action("carried", "completed", "active copy"), action("unnamed", "active")],
        archivedRounds: [
          { actions: [action("other", "completed"), action("carried", "active", "round 1 copy")] },
          { actions: [action("unnamed", "declared")] },
          { actions: [action("archived-only", "completed")] },
        ],
        id: "encounter-items",
        status: "archived",
      });
      // A row for another Encounter does not make its action id count here.
      await createEncounter(prisma!, {
        archivedRounds: [{ actions: [action("unnamed", "completed")] }],
        id: "encounter-elsewhere",
        status: "completed",
      });
      await recordItemOutcome(prisma!, "encounter-items", "carried");
      await recordItemOutcome(prisma!, "encounter-items", "archived-only");
      await recordItemOutcome(prisma!, "encounter-items", "missing");
      await recordItemOutcome(prisma!, "encounter-elsewhere", "other");

      const full = await repository().listEncountersByScenario(SCENARIO_ID);
      const session = await repository().listScenarioSessionEncounters(SCENARIO_ID);
      const fullItems = full.find((encounter) => encounter.id === "encounter-items");
      const sessionItems = session.find((encounter) => encounter.id === "encounter-items");

      expect(session.map(withoutCombat)).toEqual(full.map(withoutCombat));
      expect(sessionItems!.combatRoundState!.genericActions.map((entry) => entry.id)).toEqual([
        "carried",
      ]);
      expect(
        sessionItems!.combatRoundState!.rounds.map((round) => ({
          actions: round.genericActions.map((entry) => entry.id),
          roundNumber: round.roundNumber,
        })),
      ).toEqual([
        { actions: ["carried"], roundNumber: 1 },
        { actions: ["archived-only"], roundNumber: 3 },
      ]);
      expect(sessionItems!.combatRoundState!.roundNumber).toBe(
        fullItems!.combatRoundState!.roundNumber,
      );
      for (const actionId of ["carried", "archived-only", "missing"]) {
        expect(findAction(sessionItems, actionId)).toEqual(findAction(fullItems, actionId));
      }
      expect(findAction(sessionItems, "carried")?.intent).toBe("active copy");
      expect(sessionItems!.combatRoundState!.commands).toEqual([]);
      expect(
        sessionItems!.combatRoundState!.rounds.every((round) => round.commands.length === 0),
      ).toBe(true);

      // Named only by another Encounter's row: a combat state exists, but holds no action.
      const elsewhere = session.find((encounter) => encounter.id === "encounter-elsewhere");
      expect(elsewhere!.combatRoundState!.genericActions).toEqual([]);
      expect(elsewhere!.combatRoundState!.rounds).toEqual([]);
      expect(findAction(elsewhere, "other")).toBeUndefined();
      expect(
        findAction(
          full.find((encounter) => encounter.id === "encounter-elsewhere"),
          "other",
        ),
      ).toBeUndefined();
    });

    it("reads a finished Encounter still in legacy storage in full", async () => {
      await createEncounter(prisma!, {
        archivedRounds: [{ actions: [action("legacy-item", "completed")] }],
        id: "encounter-legacy",
        legacy: true,
        status: "completed",
      });
      const full = await repository().listEncountersByScenario(SCENARIO_ID);
      const session = await repository().listScenarioSessionEncounters(SCENARIO_ID);

      expect(full[0]!.combatRoundState!.rounds).toHaveLength(1);
      expect(session).toEqual(full);
    });

    it("still fails closed on a finished Encounter whose split rows disagree", async () => {
      await createEncounter(prisma!, {
        archivedRounds: [{}, {}],
        id: "encounter-broken",
        status: "completed",
      });
      const stored = await prisma!.encounter.findUniqueOrThrow({
        where: { id: "encounter-broken" },
      });
      // Only the archive count disagrees; the revision is written back unchanged.
      await prisma!.encounter.update({
        data: { combatArchiveCount: 5, updatedAt: stored.updatedAt },
        where: { id: "encounter-broken" },
      });

      await expect(repository().listEncountersByScenario(SCENARIO_ID)).rejects.toBeInstanceOf(
        CombatPersistenceError,
      );
      await expect(repository().listScenarioSessionEncounters(SCENARIO_ID)).rejects.toThrow(
        "archived round count does not match the stored archive count",
      );
    });
  });
}

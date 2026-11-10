import { beforeEach, describe, expect, it, vi } from "vitest";

import { encounterSessionSchema, type EncounterSession } from "@glantri/domain";

const mocks = vi.hoisted(() => ({
  prisma: {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    encounter: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    scenarioEventLog: { create: vi.fn() },
    scenario: { findUnique: vi.fn() },
    scenarioParticipant: { findMany: vi.fn() },
  },
}));

vi.mock("../client", () => ({
  prisma: mocks.prisma,
}));

import { createPrismaEncounterRepository, EncounterPresenceError } from "./encounterRepository";

const baseSession: EncounterSession = {
  actionLog: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  currentRound: 1,
  currentTurnIndex: 0,
  declarationsLocked: false,
  id: "encounter-1",
  kind: "roleplay",
  participants: [],
  status: "draft",
  title: "Courtyard",
  turnOrderMode: "manual",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("encounterRepository trusted identifiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.prisma.scenario.findUnique.mockResolvedValue({ status: "live" });
  });
  it("uses trusted scenario and campaign ids when creating an encounter", async () => {
    const repository = createPrismaEncounterRepository();
    mocks.prisma.encounter.create.mockImplementation(async ({ data }) => ({
      campaignId: data.campaignId,
      createdAt: new Date(baseSession.createdAt),
      id: data.id,
      name: data.name,
      scenarioId: data.scenarioId,
      sessionJson: data.sessionJson,
      status: data.status,
      updatedAt: new Date(baseSession.updatedAt),
    }));

    const encounter = await repository.createEncounter({
      campaignId: "campaign-1",
      createdByUserId: "gm-1",
      scenarioId: "scenario-1",
      session: {
        ...baseSession,
        campaignId: "campaign-evil",
        scenarioId: "scenario-evil",
      },
    });

    expect(mocks.prisma.encounter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "campaign-1",
        createdByUserId: "gm-1",
        scenarioId: "scenario-1",
      }),
    });
    expect(mocks.prisma.encounter.create.mock.calls[0]?.[0].data.sessionJson).toMatchObject({
      campaignId: "campaign-1",
      scenarioId: "scenario-1",
    });
    expect(encounter).toMatchObject({
      campaignId: "campaign-1",
      scenarioId: "scenario-1",
    });
  });

  it("updates the trusted encounter id instead of the body id", async () => {
    const repository = createPrismaEncounterRepository();
    const persistedUpdatedAt = "2026-01-01T00:00:01.000Z";
    mocks.prisma.encounter.findUniqueOrThrow.mockResolvedValue({
      activeCombatState: null,
      archivedCombatRounds: [],
      campaignId: "campaign-1",
      combatArchiveCount: 0,
      combatStorageMode: "legacy",
      createdAt: new Date(baseSession.createdAt),
      id: baseSession.id,
      name: baseSession.title,
      scenarioId: "scenario-1",
      sessionJson: baseSession,
      status: baseSession.status,
      updatedAt: new Date(baseSession.updatedAt),
    });
    mocks.prisma.encounter.update.mockImplementation(async ({ data, where }) => ({
      campaignId: data.campaignId,
      createdAt: new Date(baseSession.createdAt),
      id: where.id,
      name: data.name,
      scenarioId: data.scenarioId,
      sessionJson: data.sessionJson,
      status: data.status,
      updatedAt: new Date(persistedUpdatedAt),
    }));

    const encounter = await repository.updateEncounter({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      session: {
        ...baseSession,
        campaignId: "campaign-evil",
        id: "encounter-evil",
        scenarioId: "scenario-evil",
      },
    });

    expect(mocks.prisma.encounter.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "campaign-1",
        scenarioId: "scenario-1",
      }),
      where: { id: "encounter-1" },
    });
    expect(mocks.prisma.encounter.update.mock.calls[0]?.[0].data.sessionJson).toMatchObject({
      campaignId: "campaign-1",
      id: "encounter-1",
      scenarioId: "scenario-1",
    });
    expect(encounter).toMatchObject({
      campaignId: "campaign-1",
      id: "encounter-1",
      scenarioId: "scenario-1",
      updatedAt: persistedUpdatedAt,
    });
    expect(mocks.prisma.encounter.update.mock.calls[0]?.[0].data.sessionJson).toMatchObject({
      updatedAt: baseSession.updatedAt,
    });
  });

  it("loads scenario summaries without selecting the full session JSON", async () => {
    const repository = createPrismaEncounterRepository();
    mocks.prisma.encounter.findMany.mockResolvedValue([
      {
        campaignId: "campaign-1",
        createdAt: new Date(baseSession.createdAt),
        id: baseSession.id,
        name: baseSession.title,
        scenarioId: "scenario-1",
        status: baseSession.status,
        updatedAt: new Date(baseSession.updatedAt),
      },
    ]);

    await expect(repository.listEncounterSummariesByScenario("scenario-1")).resolves.toEqual([
      {
        campaignId: "campaign-1",
        createdAt: baseSession.createdAt,
        id: baseSession.id,
        scenarioId: "scenario-1",
        status: baseSession.status,
        title: baseSession.title,
        updatedAt: baseSession.updatedAt,
      },
    ]);
    expect(mocks.prisma.encounter.findMany).toHaveBeenCalledWith({
      orderBy: { updatedAt: "desc" },
      select: {
        campaignId: true,
        createdAt: true,
        id: true,
        name: true,
        scenarioId: true,
        status: true,
        updatedAt: true,
      },
      where: { scenarioId: "scenario-1" },
    });
  });

  it("rejects an overlapping active participant before writing the Encounter", async () => {
    const repository = createPrismaEncounterRepository();
    const active = encounterSessionSchema.parse({
      ...baseSession,
      participantMembershipMode: "explicit",
      participants: [
        {
          id: "encounter-participant-a",
          label: "Player A",
          participantType: "scenario",
          scenarioParticipantId: "participant-a",
        },
      ],
      scenarioId: "scenario-1",
      status: "active",
    });
    mocks.prisma.encounter.findUniqueOrThrow.mockResolvedValue({
      activeCombatState: null,
      archivedCombatRounds: [],
      campaignId: "campaign-1",
      combatArchiveCount: 0,
      combatStorageMode: "legacy",
      createdAt: new Date(baseSession.createdAt),
      id: active.id,
      name: active.title,
      scenarioId: "scenario-1",
      sessionJson: baseSession,
      status: "draft",
      updatedAt: new Date(baseSession.updatedAt),
    });
    mocks.prisma.scenarioParticipant.findMany.mockResolvedValue([
      { id: "participant-a", isActive: true, snapshotJson: { displayName: "Alder" } },
    ]);
    mocks.prisma.encounter.findMany.mockResolvedValue([
      {
        id: "encounter-2",
        name: "Courtyard",
        sessionJson: { ...active, id: "encounter-2", title: "Courtyard" },
        status: "active",
      },
    ]);

    await expect(
      repository.updateEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        scenarioId: "scenario-1",
        session: active,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EncounterPresenceError>>({
        code: "participant_already_active",
      }),
    );
    expect(mocks.prisma.encounter.update).not.toHaveBeenCalled();
    expect(mocks.prisma.scenarioEventLog.create).not.toHaveBeenCalled();
  });
});

describe("an Encounter roster holding an inactive Scenario participant (#845)", () => {
  const active = encounterSessionSchema.parse({
    ...baseSession,
    participantMembershipMode: "explicit",
    participants: [
      {
        id: "encounter-participant-a",
        label: "Player A",
        participantType: "scenario",
        scenarioParticipantId: "participant-a",
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
  });

  function stubStoredEncounter(): void {
    mocks.prisma.encounter.findUniqueOrThrow.mockResolvedValue({
      activeCombatState: null,
      archivedCombatRounds: [],
      campaignId: "campaign-1",
      combatArchiveCount: 0,
      combatStorageMode: "legacy",
      createdAt: new Date(active.createdAt),
      id: active.id,
      name: active.title,
      scenarioId: "scenario-1",
      sessionJson: active,
      status: "active",
      updatedAt: new Date(active.updatedAt),
    });
    mocks.prisma.encounter.update.mockImplementation(async ({ data }) => ({
      campaignId: "campaign-1",
      createdAt: new Date(active.createdAt),
      id: active.id,
      name: data.name ?? active.title,
      scenarioId: "scenario-1",
      sessionJson: data.sessionJson ?? active,
      status: data.status ?? "active",
      updatedAt: new Date(data.updatedAt ?? active.updatedAt),
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.prisma.scenario.findUnique.mockResolvedValue({ status: "live" });
    mocks.prisma.encounter.findMany.mockResolvedValue([]);
    mocks.prisma.scenarioParticipant.findMany.mockResolvedValue([
      { id: "participant-a", isActive: false, snapshotJson: { displayName: "Glim Fairwater" } },
    ]);
    stubStoredEncounter();
  });

  it("refuses an ordinary combat write, naming the combatant and both remedies", async () => {
    const repository = createPrismaEncounterRepository();

    await expect(
      repository.updateCombatEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        scenarioId: "scenario-1",
        session: active,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EncounterPresenceError>>({ code: "inactive_participant" }),
    );
    expect(mocks.prisma.encounter.update).not.toHaveBeenCalled();
  });

  it("does not tell the GM to refresh, which cannot help", async () => {
    const repository = createPrismaEncounterRepository();
    const error = await repository
      .updateCombatEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        scenarioId: "scenario-1",
        session: active,
      })
      .then(
        () => undefined,
        (caught: unknown) => caught as Error,
      );

    expect(error?.message).toContain("Glim Fairwater");
    expect(error?.message.toLowerCase()).not.toContain("refresh");
    expect(error?.message.toLowerCase()).not.toContain("before starting the encounter");
  });

  it("lets the recovery control past the activity condition when it asks for that allowance", async () => {
    const repository = createPrismaEncounterRepository();
    mocks.prisma.encounter.updateMany.mockResolvedValue({ count: 1 });
    const error = await repository
      .updateCombatEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        permitInactiveRosterParticipants: true,
        scenarioId: "scenario-1",
        session: active,
      })
      .then(() => undefined)
      .catch((caught: unknown) => caught as EncounterPresenceError);

    // The write reaches persistence, which this prisma double does not fully stand in for. What is
    // asserted is that the activity condition no longer stopped it: the refusal that blocked this
    // control on #845 is gone, and the end-to-end `200` is measured against a real database.
    expect(error?.code).not.toBe("inactive_participant");
    expect(mocks.prisma.encounter.updateMany).toHaveBeenCalled();
  });

  it("keeps every other presence condition even with that allowance", async () => {
    const repository = createPrismaEncounterRepository();
    // The same participant is already a combatant in another running Encounter. That condition is
    // nothing to do with activity, so the allowance must not reach it.
    mocks.prisma.encounter.findMany.mockResolvedValue([
      {
        id: "encounter-2",
        name: "Courtyard",
        sessionJson: { ...active, id: "encounter-2", title: "Courtyard" },
        status: "active",
      },
    ]);

    await expect(
      repository.updateCombatEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        permitInactiveRosterParticipants: true,
        scenarioId: "scenario-1",
        session: active,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EncounterPresenceError>>({
        code: "participant_already_active",
      }),
    );
    expect(mocks.prisma.encounter.update).not.toHaveBeenCalled();
  });

  it("still refuses the allowance when the parent Scenario is not live", async () => {
    const repository = createPrismaEncounterRepository();
    mocks.prisma.scenario.findUnique.mockResolvedValue({ status: "completed" });

    await expect(
      repository.updateCombatEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        permitInactiveRosterParticipants: true,
        scenarioId: "scenario-1",
        session: active,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EncounterPresenceError>>({
        code: "parent_scenario_not_active",
      }),
    );
  });

  it("refuses a roster row whose Scenario participant has gone, allowance or not", async () => {
    const repository = createPrismaEncounterRepository();
    mocks.prisma.scenarioParticipant.findMany.mockResolvedValue([]);

    await expect(
      repository.updateCombatEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        permitInactiveRosterParticipants: true,
        scenarioId: "scenario-1",
        session: active,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<EncounterPresenceError>>({ code: "inactive_participant" }),
    );
    expect(mocks.prisma.encounter.update).not.toHaveBeenCalled();
  });

  it("does not read participant snapshots when every roster participant is active", async () => {
    const repository = createPrismaEncounterRepository();
    mocks.prisma.scenarioParticipant.findMany.mockImplementation(
      async (args: { select: Record<string, boolean> }) => [
        {
          id: "participant-a",
          isActive: true,
          ...(args.select.snapshotJson ? { snapshotJson: {} } : {}),
        },
      ],
    );
    mocks.prisma.encounter.updateMany.mockResolvedValue({ count: 1 });

    await repository
      .updateCombatEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        scenarioId: "scenario-1",
        session: active,
      })
      .catch(() => undefined);

    expect(mocks.prisma.scenarioParticipant.findMany).toHaveBeenCalled();
    for (const [args] of mocks.prisma.scenarioParticipant.findMany.mock.calls) {
      expect(args.select).not.toHaveProperty("snapshotJson");
    }
  });

  it("names one inactive combatant, reading the snapshot only for the refusal", async () => {
    const repository = createPrismaEncounterRepository();
    mocks.prisma.scenarioParticipant.findMany.mockImplementation(
      async (args: { select: Record<string, boolean> }) => [
        {
          id: "participant-a",
          isActive: false,
          ...(args.select.snapshotJson ? { snapshotJson: { displayName: "Glim Fairwater" } } : {}),
        },
      ],
    );
    const error = await repository
      .updateCombatEncounter({
        encounterId: active.id,
        expectedRevision: active.updatedAt,
        scenarioId: "scenario-1",
        session: active,
      })
      .then(
        () => undefined,
        (caught: unknown) => caught as EncounterPresenceError,
      );

    expect(error?.message).toBe(
      "Glim Fairwater is not an active participant in this Scenario, so this Encounter cannot " +
        "run with them on its roster. Either make them active in the Scenario again, or take " +
        "them out of the Encounter roster.",
    );
  });

  it("names several inactive combatants as 'A, B and C', falling back to the id", async () => {
    const repository = createPrismaEncounterRepository();
    const three = encounterSessionSchema.parse({
      ...active,
      participants: ["a", "b", "c"].map((letter) => ({
        id: `encounter-participant-${letter}`,
        label: letter,
        participantType: "scenario",
        scenarioParticipantId: `participant-${letter}`,
      })),
    });
    mocks.prisma.encounter.findUniqueOrThrow.mockResolvedValue({
      activeCombatState: null,
      archivedCombatRounds: [],
      campaignId: "campaign-1",
      combatArchiveCount: 0,
      combatStorageMode: "legacy",
      createdAt: new Date(three.createdAt),
      id: three.id,
      name: three.title,
      scenarioId: "scenario-1",
      sessionJson: three,
      status: "active",
      updatedAt: new Date(three.updatedAt),
    });
    const snapshots: Record<string, unknown> = {
      "participant-a": { displayName: "Alder" },
      "participant-b": { displayName: "   " },
      "participant-c": { displayName: "Cask" },
    };
    mocks.prisma.scenarioParticipant.findMany.mockImplementation(
      async (args: { select: Record<string, boolean> }) =>
        Object.keys(snapshots).map((id) => ({
          id,
          isActive: false,
          ...(args.select.snapshotJson ? { snapshotJson: snapshots[id] } : {}),
        })),
    );
    const error = await repository
      .updateCombatEncounter({
        encounterId: three.id,
        expectedRevision: three.updatedAt,
        scenarioId: "scenario-1",
        session: three,
      })
      .then(
        () => undefined,
        (caught: unknown) => caught as EncounterPresenceError,
      );

    expect(error?.message).toBe(
      "Alder, participant-b and Cask are not active participants in this Scenario, so this " +
        "Encounter cannot run with them on its roster. Either make them active in the Scenario " +
        "again, or take them out of the Encounter roster.",
    );
  });
});

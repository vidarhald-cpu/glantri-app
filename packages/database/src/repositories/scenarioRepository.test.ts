import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    campaign: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    encounter: {
      findMany: vi.fn(),
    },
    scenario: {
      findMany: vi.fn(),
    },
    scenarioParticipant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock("../client", () => ({
  prisma: mocks.prisma,
}));

import { createPrismaScenarioRepository } from "./scenarioRepository";

describe("scenarioRepository player scenario access queries", () => {
  it("treats non-draft controlled Scenario history as player-accessible", async () => {
    mocks.prisma.campaign.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.listCampaignsByPlayerAccess("player-1");

    expect(mocks.prisma.campaign.findMany).toHaveBeenCalledWith({
      orderBy: { updatedAt: "desc" },
      where: {
        scenarios: {
          some: expect.objectContaining({
            status: { in: ["live", "paused", "completed", "archived"] },
          }),
        },
      },
    });
  });

  it("lists non-draft scenarios for player Campaign workspace access", async () => {
    mocks.prisma.scenario.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.listScenariosByCampaignPlayerAccess("campaign-1", "player-1");

    expect(mocks.prisma.scenario.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      where: expect.objectContaining({
        campaignId: "campaign-1",
        status: { in: ["live", "paused", "completed", "archived"] },
      }),
    });
  });

  it("excludes delegated owners from current-control Scenario access", async () => {
    mocks.prisma.scenario.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.listScenariosByCampaignPlayerControl("campaign-1", "player-1");

    expect(mocks.prisma.scenario.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      where: {
        campaignId: "campaign-1",
        participants: {
          some: {
            OR: [
              { controlledByUserId: "player-1" },
              {
                character: { ownerId: "player-1" },
                controlledByUserId: null,
              },
            ],
            isActive: true,
            role: "player_character",
          },
        },
        status: { in: ["live", "paused", "completed", "archived"] },
      },
    });
  });
});

describe("scenarioRepository campaign activation transitions", () => {
  it("activates a draft Campaign and returns the next Campaign state", async () => {
    const activeCampaign = {
      createdAt: new Date("2026-05-08T12:00:00.000Z"),
      description: "The campaign",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Draft Campaign",
      settingsJson: {},
      slug: "draft-campaign",
      status: "active",
      updatedAt: new Date("2026-05-08T12:00:00.000Z"),
    };
    mocks.prisma.campaign.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.campaign.findUnique.mockResolvedValue(activeCampaign);

    const repository = createPrismaScenarioRepository();

    await expect(
      repository.activateCampaignFromDraft({ campaignId: "campaign-1" }),
    ).resolves.toEqual({
      createdAt: "2026-05-08T12:00:00.000Z",
      description: "The campaign",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Draft Campaign",
      settings: {
        allowPlayerSelfJoin: false,
        defaultVisibility: "hidden",
      },
      slug: "draft-campaign",
      status: "active",
      updatedAt: "2026-05-08T12:00:00.000Z",
    });
    expect(mocks.prisma.campaign.updateMany).toHaveBeenCalledWith({
      data: { status: "active" },
      where: {
        id: "campaign-1",
        status: "draft",
      },
    });
  });

  it.each([
    {
      from: "draft",
      to: "archived",
    },
    {
      from: "active",
      to: "archived",
    },
    {
      from: "archived",
      to: "draft",
    },
    {
      from: "active",
      to: "draft",
    },
    {
      from: "archived",
      to: "active",
    },
    {
      from: "active",
      to: "active",
    },
  ])("does not mutate Campaign for blocked transition from $from to $to", async ({ from, to }) => {
    const isAllowed = from === "draft" && to === "active";
    mocks.prisma.campaign.updateMany.mockResolvedValue({ count: 0 });

    expect(isAllowed).toBe(false);
    const repository = createPrismaScenarioRepository();

    await expect(repository.activateCampaignFromDraft({ campaignId: "campaign-1" })).resolves.toBe(
      null,
    );
    expect(mocks.prisma.campaign.updateMany).toHaveBeenCalledWith({
      data: { status: "active" },
      where: {
        id: "campaign-1",
        status: "draft",
      },
    });
    expect(mocks.prisma.campaign.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for stale interleaving where the campaign left draft before activation", async () => {
    mocks.prisma.campaign.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.campaign.findUnique.mockResolvedValue(null);

    const repository = createPrismaScenarioRepository();

    await expect(repository.activateCampaignFromDraft({ campaignId: "campaign-1" })).resolves.toBe(
      null,
    );
    expect(mocks.prisma.campaign.findUnique).not.toHaveBeenCalled();
  });
});

/**
 * Forgejo issue #977. The GM predicate in `scenarioParticipantSupport.ts` reads the role of an
 * arbitrary candidate user through this method, so it must report the same normalized names the
 * session path reports — otherwise a legacy stored `gm` row would silently strip a real GM of
 * the exemption the ruling preserved for them.
 */
describe("scenarioRepository listUserAuthRoles (#977)", () => {
  it("normalizes the legacy stored gm role name to game_master", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      roles: [{ role: { name: "gm" } }, { role: { name: "player" } }],
    });
    const repository = createPrismaScenarioRepository();

    await expect(repository.listUserAuthRoles("user-1")).resolves.toEqual([
      "game_master",
      "player",
    ]);
  });

  it("drops a stored role name that is not an application role", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      roles: [{ role: { name: "game_master" } }, { role: { name: "observer" } }],
    });
    const repository = createPrismaScenarioRepository();

    await expect(repository.listUserAuthRoles("user-1")).resolves.toEqual(["game_master"]);
  });

  it("reports no roles for a user that cannot be read, so predicates over it fail closed", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    const repository = createPrismaScenarioRepository();

    await expect(repository.listUserAuthRoles("missing-user")).resolves.toEqual([]);
  });
});

describe("scenarioRepository participant deactivation against a running Encounter (#845)", () => {
  function participantRow(isActive: boolean) {
    return {
      characterId: "character-1",
      controlledByUserId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      entityId: null,
      factionId: null,
      displayOrder: null,
      initiativeSlot: null,
      id: "participant-1",
      isActive,
      joinSource: "gm_added",
      positionJson: null,
      role: "player_character",
      roleTag: null,
      scenarioId: "scenario-1",
      snapshotJson: { displayName: "Glim Fairwater" },
      sourceType: "character",
      stateJson: {
        combat: {},
        equipment: {},
        health: {},
        resources: {},
      },
      tacticalGroupId: null,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      visibilityOverridesJson: null,
    };
  }

  function runningEncounter(input: { held?: string[]; inForce: string[]; title?: string }) {
    return {
      id: "encounter-1",
      name: input.title ?? "Courtyard",
      sessionJson: {
        participants: input.inForce.map((scenarioParticipantId) => ({ scenarioParticipantId })),
        ...(input.held
          ? {
              pendingParticipants: input.held.map((scenarioParticipantId) => ({
                scenarioParticipantId,
              })),
            }
          : {}),
      },
      status: "active",
    };
  }

  beforeEach(() => {
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(mocks.prisma),
    );
    mocks.prisma.$queryRaw.mockResolvedValue([{ id: "scenario-1" }]);
    mocks.prisma.scenarioParticipant.update.mockResolvedValue(participantRow(false));
    mocks.prisma.scenarioParticipant.findUnique.mockResolvedValue({
      scenarioId: "scenario-1",
      snapshotJson: { displayName: "Glim Fairwater" },
    });
  });

  it("refuses the deactivation and writes nothing when a running Encounter holds the combatant", async () => {
    mocks.prisma.encounter.findMany.mockResolvedValue([
      runningEncounter({ inForce: ["participant-1"] }),
    ]);
    const repository = createPrismaScenarioRepository();

    await expect(
      repository.updateScenarioParticipantMetadata({
        isActive: false,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "encounter_participant_set_frozen" }));
    expect(mocks.prisma.scenarioParticipant.update).not.toHaveBeenCalled();
  });

  it("names the combatant and the Encounter in the refusal, and never says refresh", async () => {
    mocks.prisma.encounter.findMany.mockResolvedValue([
      runningEncounter({ inForce: ["participant-1"], title: "Gatehouse" }),
    ]);
    const repository = createPrismaScenarioRepository();
    const error = await repository
      .updateScenarioParticipantMetadata({
        isActive: false,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      })
      .then(
        () => undefined,
        (caught: unknown) => caught as Error,
      );

    expect(error?.message).toContain("Glim Fairwater");
    expect(error?.message).toContain("Gatehouse");
    expect(error?.message.toLowerCase()).not.toContain("refresh");
  });

  it("refuses it when the combatant is only on the roster held for the round boundary", async () => {
    mocks.prisma.encounter.findMany.mockResolvedValue([
      runningEncounter({ held: ["participant-1"], inForce: ["participant-2"] }),
    ]);
    const repository = createPrismaScenarioRepository();

    await expect(
      repository.updateScenarioParticipantMetadata({
        isActive: false,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "encounter_participant_set_frozen" }));
  });

  // Corrected in the #845 QA cycle-1 repair. This case was titled "… so the pair cannot interleave".
  // The lock does not achieve that, and QA measured it false — 19 interleavings in 30 races. It pins
  // the statement order only. The boundary is pinned by the two isolation/retry cases below.
  it("takes the Scenario row lock before reading the Encounters", async () => {
    mocks.prisma.encounter.findMany.mockResolvedValue([
      runningEncounter({ inForce: ["participant-1"] }),
    ]);
    const repository = createPrismaScenarioRepository();

    await repository
      .updateScenarioParticipantMetadata({
        isActive: false,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      })
      .catch(() => undefined);

    expect(mocks.prisma.$queryRaw).toHaveBeenCalled();
    const lockOrder = mocks.prisma.$queryRaw.mock.invocationCallOrder[0];
    const readOrder = mocks.prisma.encounter.findMany.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(readOrder as number);
  });

  // #845 QA cycle 1: this is what actually holds the boundary. The Encounter write is Serializable,
  // so while this ran at READ COMMITTED the activation could take its snapshot, let this transaction
  // take the lock and commit, then take the same lock afterwards and still read the pre-commit
  // `isActive` with no error. Only matching the level makes the pair a cycle PostgreSQL must break.
  it("runs the deactivation at Serializable, matching the Encounter write it races", async () => {
    mocks.prisma.encounter.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.updateScenarioParticipantMetadata({
      isActive: false,
      participantId: "participant-1",
      scenarioId: "scenario-1",
    });

    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("re-decides on a fresh read after a serialization failure instead of reporting success", async () => {
    // Attempt 1 loses the cycle to the Encounter activation, which therefore committed. Attempt 2
    // reads the Encounter it could not see before, so the retry must produce the refusal.
    const conflict = new Prisma.PrismaClientKnownRequestError("write conflict", {
      clientVersion: "test",
      code: "P2034",
    });
    let attempts = 0;
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      attempts += 1;
      if (attempts === 1) throw conflict;
      return callback(mocks.prisma);
    });
    mocks.prisma.encounter.findMany.mockResolvedValue([
      runningEncounter({ inForce: ["participant-1"] }),
    ]);
    const repository = createPrismaScenarioRepository();

    await expect(
      repository.updateScenarioParticipantMetadata({
        isActive: false,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "encounter_participant_set_frozen" }));
    expect(attempts).toBe(2);
    expect(mocks.prisma.scenarioParticipant.update).not.toHaveBeenCalled();
  });

  it("reports an exhausted serialization retry as a conflict, and does not claim the set is frozen", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("write conflict", {
      clientVersion: "test",
      code: "P2034",
    });
    let attempts = 0;
    mocks.prisma.$transaction.mockImplementation(async () => {
      attempts += 1;
      throw conflict;
    });
    const repository = createPrismaScenarioRepository();

    await expect(
      repository.updateScenarioParticipantMetadata({
        isActive: false,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "transaction_conflict" }));
    expect(attempts).toBe(3);
  });

  it("does not retry a refusal, a validation error or any other persistence error", async () => {
    let attempts = 0;
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      attempts += 1;
      return callback(mocks.prisma);
    });
    mocks.prisma.encounter.findMany.mockResolvedValue([
      runningEncounter({ inForce: ["participant-1"] }),
    ]);
    const repository = createPrismaScenarioRepository();

    await expect(
      repository.updateScenarioParticipantMetadata({
        isActive: false,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "encounter_participant_set_frozen" }));
    expect(attempts).toBe(1);
  });

  it("allows the deactivation when no running Encounter holds the combatant", async () => {
    mocks.prisma.encounter.findMany.mockResolvedValue([
      runningEncounter({ inForce: ["participant-2"] }),
    ]);
    const repository = createPrismaScenarioRepository();

    await expect(
      repository.updateScenarioParticipantMetadata({
        isActive: false,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "participant-1", isActive: false }));
  });

  it("leaves reactivation open, because it is the move that repairs a stored bad state", async () => {
    mocks.prisma.scenarioParticipant.update.mockResolvedValue(participantRow(true));
    const repository = createPrismaScenarioRepository();

    await expect(
      repository.updateScenarioParticipantMetadata({
        isActive: true,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      }),
    ).resolves.toEqual(expect.objectContaining({ isActive: true }));
    // Not even consulted: reactivation cannot create the condition, so it costs no transaction.
    expect(mocks.prisma.encounter.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("leaves the other metadata fields unconstrained", async () => {
    mocks.prisma.scenarioParticipant.update.mockResolvedValue(participantRow(true));
    const repository = createPrismaScenarioRepository();

    await expect(
      repository.updateScenarioParticipantMetadata({
        participantId: "participant-1",
        roleTag: "Vanguard",
        scenarioId: "scenario-1",
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "participant-1" }));
    expect(mocks.prisma.encounter.findMany).not.toHaveBeenCalled();
  });

  it("refuses a participant id that belongs to another Scenario, before writing anything", async () => {
    mocks.prisma.scenarioParticipant.findUnique.mockResolvedValue({
      scenarioId: "scenario-2",
      snapshotJson: { displayName: "Glim Fairwater" },
    });
    mocks.prisma.encounter.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await expect(
      repository.updateScenarioParticipantMetadata({
        isActive: false,
        participantId: "participant-1",
        scenarioId: "scenario-1",
      }),
    ).rejects.toThrow("does not belong to this Scenario");
    expect(mocks.prisma.scenarioParticipant.update).not.toHaveBeenCalled();
  });

  it("asks only for this Scenario's running Encounters", async () => {
    mocks.prisma.encounter.findMany.mockResolvedValue([]);
    const repository = createPrismaScenarioRepository();

    await repository.updateScenarioParticipantMetadata({
      isActive: false,
      participantId: "participant-1",
      scenarioId: "scenario-1",
    });

    expect(mocks.prisma.encounter.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, sessionJson: true, status: true },
      where: { scenarioId: "scenario-1", status: "active" },
    });
  });
});

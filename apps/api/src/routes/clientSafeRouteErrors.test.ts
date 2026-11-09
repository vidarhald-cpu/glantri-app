import { createRequire } from "node:module";
import { Writable } from "node:stream";

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Forgejo #1048: a persistence failure on an API route reached the client as its raw Prisma text,
 * including a server file path. Route-level proof on the two shapes that carried it:
 * `GET /encounters/:encounterId`, whose own catch echoed `error.message`, and a Character Equipment
 * route answered through `handleRouteError`. Deliberate user-facing errors keep their exact bodies.
 */

const mocks = vi.hoisted(() => ({
  addItem: vi.fn(),
  campaignService: { getCampaignById: vi.fn(), listCampaignsByCharacterRosterAccess: vi.fn() },
  encounterService: { getEncounterById: vi.fn() },
  getState: vi.fn(),
  requireAccess: vi.fn(),
  requireAdminUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  requireRead: vi.fn(),
  scenarioService: {
    getScenarioById: vi.fn(),
    listScenarioParticipants: vi.fn(),
    userHasPlayerScenarioAccess: vi.fn(),
  },
}));

vi.mock("@glantri/database", () => ({
  ArtifactImportService: vi.fn(() => ({})),
  CampaignCharacterAlreadyRosteredError: class extends Error {},
  CampaignCharacterRosterCandidateNotFoundError: class extends Error {},
  CampaignMapService: vi.fn(() => ({})),
  CampaignMapConflictError: class extends Error {},
  CampaignMapNotFoundError: class extends Error {},
  CampaignMapReferenceError: class extends Error {},
  CampaignManagementService: vi.fn(() => ({})),
  CampaignNoteConflictError: class extends Error {},
  CampaignNoteNotFoundError: class extends Error {},
  CampaignNoteReferenceError: class extends Error {},
  CampaignService: vi.fn(() => mocks.campaignService),
  CharacterEquipmentReadModelService: vi.fn(() => ({ getCharacterEquipmentState: mocks.getState })),
  CharacterEquipmentWriteService: vi.fn(() => ({ addCharacterEquipmentItem: mocks.addItem })),
  CharacterService: vi.fn(() => ({})),
  CombatItemInteractionService: vi.fn(() => ({})),
  CombatItemUnavailableError: class extends Error {},
  CombatStateReadService: vi.fn(() => ({})),
  EncounterCombatWriteError: class extends Error {},
  EncounterService: vi.fn(() => mocks.encounterService),
  EncounterWriteError: class extends Error {},
  ScenarioEquipmentStaleError: class extends Error {},
  ScenarioService: vi.fn(() => mocks.scenarioService),
  ScenarioSessionWriteError: class extends Error {},
  StaleCharacterEquipmentAggregateError: class StaleCharacterEquipmentAggregateError extends Error {},
}));

vi.mock("../lib/sessionAuth", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("./characterEquipment/access", () => ({
  requireAccessibleCharacter: mocks.requireAccess,
  requireReadableCharacter: mocks.requireRead,
}));

import { CLIENT_SAFE_INTERNAL_ERROR_MESSAGE } from "../lib/errors";
import { equipmentItemRoutes } from "./characterEquipment/itemRoutes";
import { scenariosRoutes } from "./scenarios";

// The genuine Prisma runtime classes, resolved from the database package that owns the dependency.
const prismaRuntime = createRequire(
  new URL("../../../../packages/database/package.json", import.meta.url),
)("@prisma/client/runtime/library") as {
  PrismaClientKnownRequestError: new (
    message: string,
    params: { clientVersion: string; code: string },
  ) => Error;
  PrismaClientValidationError: new (message: string, params: { clientVersion: string }) => Error;
};

const SERVER_PATH = "/srv/glantri/packages/database/src/repositories/encounterRepository.ts";

/** The #1021 D1 shape: a transaction that could not start, reported with the invocation path. */
function prismaTransactionError(): Error {
  return new prismaRuntime.PrismaClientKnownRequestError(
    `\nInvalid \`prisma.encounter.findUnique()\` invocation in\n${SERVER_PATH}:41:28\n\nTransaction API error: Unable to start a transaction in the given time.`,
    { clientVersion: "6.19.2", code: "P2028" },
  );
}

/** The verbatim shape of a genuine Prisma validation failure: path plus a source excerpt. */
function prismaValidationError(): Error {
  return new prismaRuntime.PrismaClientValidationError(
    `\nInvalid \`prisma.characterEquipmentItem.create()\` invocation in\n${SERVER_PATH}:212:9\n\n→ 212 await tx.characterEquipmentItem.create({ data })\n\nArgument \`quantity\`: Invalid value provided. Expected Int, provided String.`,
    { clientVersion: "6.19.2" },
  );
}

function expectNoServerDetail(body: string) {
  expect(body).not.toContain("prisma");
  expect(body).not.toContain("Prisma");
  expect(body).not.toContain("/srv/");
  expect(body).not.toContain(".ts:");
  expect(body).not.toContain("invocation");
  expect(body).not.toContain("Transaction API error");
  expect(body).not.toContain(" at ");
}

const characterId = "character-1";
const addItemPayload = {
  expectedRevision: 0,
  initialCarryMode: "equipped",
  initialLocationId: `${characterId}:loc-equipped`,
  quantity: 1,
  templateId: "weapon-template-dagger",
};

describe("client-safe route errors (#1048)", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];
  let logLines: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    logLines = [];
    const user = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };
    mocks.requireAuthenticatedUser.mockResolvedValue(user);
    mocks.requireAdminUser.mockResolvedValue(user);
    mocks.requireAccess.mockResolvedValue({ characterId, kind: "owner" });
    mocks.getState.mockResolvedValue({
      activeLoadoutByCharacterId: {},
      itemsById: {},
      locationsById: {},
      templatesById: {},
    });
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildApp() {
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logLines.push(String(chunk));
        callback();
      },
    });
    const app = Fastify({ logger: { level: "error", stream } });
    apps.push(app);
    await app.register(scenariosRoutes);
    await app.register(equipmentItemRoutes, { prefix: "/characters" });
    return app;
  }

  const getEncounter = async () =>
    (await buildApp()).inject({ method: "GET", url: "/encounters/encounter-1" });
  const addItem = async () =>
    (await buildApp()).inject({
      method: "POST",
      payload: addItemPayload,
      url: `/characters/${characterId}/equipment/items`,
    });

  describe("a forced persistence failure gets the fixed client-safe body", () => {
    it.each([
      ["GET /encounters/:encounterId", getEncounter, () => mocks.encounterService.getEncounterById],
      ["POST /characters/:id/equipment/items", addItem, () => mocks.addItem],
    ])("%s", async (_label, call, target) => {
      const error = prismaTransactionError();
      target().mockRejectedValue(error);

      const response = await call();

      expect(response.statusCode).toBe(500);
      expect(response.body).toBe(JSON.stringify({ error: CLIENT_SAFE_INTERNAL_ERROR_MESSAGE }));
      expectNoServerDetail(response.body);
      const logged = logLines.join("");
      expect(logged).toContain("api_route_internal_error");
      expect(logged).toContain("PrismaClientKnownRequestError");
      expect(logged).toContain("Transaction API error: Unable to start a transaction");
      expect(logged).toContain(SERVER_PATH);
    });

    it("also for a Prisma validation error carrying a source excerpt", async () => {
      mocks.addItem.mockRejectedValue(prismaValidationError());

      const response = await addItem();

      expect(response.statusCode).toBe(500);
      expectNoServerDetail(response.body);
    });

    it("also for a programming defect inside the encounter read", async () => {
      mocks.encounterService.getEncounterById.mockRejectedValue(
        new TypeError("Cannot read properties of undefined (reading 'scenarioId')"),
      );

      const response = await getEncounter();

      expect(response.statusCode).toBe(500);
      expect(response.body).toBe(JSON.stringify({ error: CLIENT_SAFE_INTERNAL_ERROR_MESSAGE }));
    });
  });

  describe("deliberate user-facing errors keep their exact status and body", () => {
    it("GET /encounters/:encounterId — absent encounter", async () => {
      mocks.encounterService.getEncounterById.mockResolvedValue(null);

      const response = await getEncounter();

      expect(response.statusCode).toBe(404);
      expect(response.body).toBe('{"error":"Encounter not found."}');
    });

    it.each([
      ["plain Error", new Error("Scenario not found.")],
      ["domain RangeError", new RangeError("Encounter participant is not in the Scenario roster.")],
    ])("GET /encounters/:encounterId — %s", async (_label, error) => {
      mocks.encounterService.getEncounterById.mockRejectedValue(error);

      const response = await getEncounter();

      expect(response.statusCode).toBe(400);
      expect(response.body).toBe(JSON.stringify({ error: error.message }));
      expect(logLines).toEqual([]);
    });

    it.each([
      ["Equipment template not found.", new Error("Equipment template not found."), 400],
      [
        "Only stackable items can have quantity greater than one.",
        new Error("Only stackable items can have quantity greater than one."),
        400,
      ],
    ])("POST /characters/:id/equipment/items — %s", async (message, error, status) => {
      mocks.addItem.mockRejectedValue(error);

      const response = await addItem();

      expect(response.statusCode).toBe(status);
      expect(response.body).toBe(JSON.stringify({ error: message }));
      expect(logLines).toEqual([]);
    });

    it("POST /characters/:id/equipment/items — stale aggregate conflict", async () => {
      const { StaleCharacterEquipmentAggregateError } = await import("@glantri/database");
      mocks.addItem.mockRejectedValue(new StaleCharacterEquipmentAggregateError());

      const response = await addItem();

      expect(response.statusCode).toBe(409);
      expect(response.body).toBe(
        '{"error":"Character equipment changed. Reload it before trying again."}',
      );
    });
  });
});

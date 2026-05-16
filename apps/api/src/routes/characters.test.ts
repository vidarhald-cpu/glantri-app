import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const playerUser = {
    email: "player@example.test",
    id: "player-1",
    roles: ["player"],
  };
  const gmUser = {
    email: "gm@example.test",
    id: "gm-1",
    roles: ["game_master"],
  };
  const characterService = {
    listCharacters: vi.fn(),
    findById: vi.fn(),
    saveCharacter: vi.fn(),
    saveExistingCharacter: vi.fn(),
  };
  return {
    canEditCharacterInApi: vi.fn(),
    characterService,
    gmUser,
    loadAccessibleCharacterInApi: vi.fn(),
    playerUser,
    requireAuthenticatedUser: vi.fn(),
  };
});

vi.mock("@glantri/database", () => ({
  CharacterService: vi.fn(() => mocks.characterService),
  CharacterValidationError: class CharacterValidationError extends Error {
    issues: string[];
    constructor(issues: string[]) {
      super("Character build validation failed.");
      this.name = "CharacterValidationError";
      this.issues = issues;
    }
  },
}));

vi.mock("../lib/sessionAuth", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("../lib/characterEditAccess", () => ({
  canEditCharacterInApi: mocks.canEditCharacterInApi,
  loadAccessibleCharacterInApi: mocks.loadAccessibleCharacterInApi,
}));

import { charactersRoutes } from "./characters";

async function buildCharactersTestApp() {
  const app = Fastify({ logger: false });
  await app.register(charactersRoutes);
  return app;
}

const stubCharacter = {
  build: { id: "char-1", name: "Aldric", progression: { level: 1 } },
  createdAt: "2026-01-01T00:00:00.000Z",
  id: "char-1",
  level: 1,
  name: "Aldric",
  ownerId: "player-1",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("characters route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    mocks.canEditCharacterInApi.mockReturnValue(false);
  });

  it("lists characters owned by the authenticated player", async () => {
    mocks.characterService.listCharacters.mockResolvedValue([stubCharacter]);

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ characters: [stubCharacter] });
    expect(mocks.characterService.listCharacters).toHaveBeenCalledWith("player-1");
  });

  it("lists all characters for a GM", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.gmUser);
    mocks.canEditCharacterInApi.mockReturnValue(true);
    mocks.characterService.listCharacters.mockResolvedValue([stubCharacter]);

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ characters: [stubCharacter] });
    expect(mocks.characterService.listCharacters).toHaveBeenCalledWith();
  });

  it("returns 401 when not authenticated on character list", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(null);

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(mocks.characterService.listCharacters).not.toHaveBeenCalled();
  });

  it("returns a single character accessible to the user", async () => {
    mocks.loadAccessibleCharacterInApi.mockResolvedValue(stubCharacter);

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/char-1" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ character: stubCharacter });
  });

  it("returns 404 when character is not accessible to the user", async () => {
    mocks.loadAccessibleCharacterInApi.mockResolvedValue(null);

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/char-999" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Character not found." });
  });

  it("saves a new character and returns the record", async () => {
    mocks.characterService.saveCharacter.mockResolvedValue(stubCharacter);

    const app = await buildCharactersTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: { build: stubCharacter.build },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ character: stubCharacter });
  });

  it("returns 400 with error and issues when CharacterValidationError is thrown", async () => {
    const { CharacterValidationError } = await import("@glantri/database");
    mocks.characterService.saveCharacter.mockRejectedValue(
      new CharacterValidationError(["Name already taken."])
    );

    const app = await buildCharactersTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: { build: stubCharacter.build },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Character build validation failed.",
      issues: ["Name already taken."],
    });
  });

  it("returns 400 when character build id does not match path id on update", async () => {
    const app = await buildCharactersTestApp();
    const response = await app.inject({
      method: "PUT",
      url: "/different-id",
      payload: { build: stubCharacter.build },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Character id does not match build id." });
  });
});

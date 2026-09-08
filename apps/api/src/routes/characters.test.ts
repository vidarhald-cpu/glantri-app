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
    deleteExistingCharacter: vi.fn(),
    findById: vi.fn(),
    listAccessibleCharacters: vi.fn(),
    saveCharacter: vi.fn(),
    saveExistingCharacter: vi.fn(),
  };
  const retainedCharacterService = {
    advanceLearningHistory: vi.fn(),
    applyMigration: vi.fn(),
    changeProfessionContext: vi.fn(),
    getCurrentProjection: vi.fn(),
    previewMigration: vi.fn(),
    projectAuthorizedRevision: vi.fn(),
    rollbackMigration: vi.fn(),
  };
  return {
    characterService,
    gmUser,
    loadAccessibleCharacterInApi: vi.fn(),
    playerUser,
    retainedCharacterService,
    requireAuthenticatedUser: vi.fn(),
  };
});

vi.mock("@glantri/database", () => ({
  CharacterMutationConflictError: class CharacterMutationConflictError extends Error {
    code: "character_already_exists" | "stale_character";
    currentCharacter?: unknown;
    constructor(
      code: "character_already_exists" | "stale_character",
      message: string,
      currentCharacter?: unknown,
    ) {
      super(message);
      this.name = "CharacterMutationConflictError";
      this.code = code;
      this.currentCharacter = currentCharacter;
    }
  },
  CharacterService: vi.fn(() => mocks.characterService),
  LegacyCharacterEquipmentWriteError: class LegacyCharacterEquipmentWriteError extends Error {},
  CharacterValidationError: class CharacterValidationError extends Error {
    issues: string[];
    constructor(issues: string[]) {
      super("Character build validation failed.");
      this.name = "CharacterValidationError";
      this.issues = issues;
    }
  },
  RetainedCharacterMutationError: class RetainedCharacterMutationError extends Error {
    constructor(
      public code: string,
      message: string,
      public currentRevisionId?: string,
    ) {
      super(message);
    }
  },
  RetainedCharacterService: vi.fn(() => mocks.retainedCharacterService),
}));

vi.mock("@glantri/domain", () => ({
  characterBuildSchema: { parse: (v: unknown) => v },
}));

vi.mock("../lib/sessionAuth", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("../lib/characterEditAccess", () => ({
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
  });

  it("lists characters owned by the authenticated player", async () => {
    mocks.characterService.listAccessibleCharacters.mockResolvedValue([stubCharacter]);

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ characters: [stubCharacter] });
    expect(mocks.characterService.listAccessibleCharacters).toHaveBeenCalledWith({
      isAdmin: false,
      isGameMaster: false,
      userId: "player-1",
    });
  });

  it("lists only characters accessible to the authenticated GM", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.gmUser);
    mocks.characterService.listAccessibleCharacters.mockResolvedValue([stubCharacter]);

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ characters: [stubCharacter] });
    expect(mocks.characterService.listAccessibleCharacters).toHaveBeenCalledWith({
      isAdmin: false,
      isGameMaster: true,
      userId: "gm-1",
    });
  });

  it("returns 401 when not authenticated on character list", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(null);

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(mocks.characterService.listAccessibleCharacters).not.toHaveBeenCalled();
  });

  it("returns a single character accessible to the user", async () => {
    mocks.loadAccessibleCharacterInApi.mockResolvedValue(stubCharacter);

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/char-1" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ character: stubCharacter });
  });

  it("returns the server-authoritative retained Skill projection", async () => {
    mocks.loadAccessibleCharacterInApi.mockResolvedValue(stubCharacter);
    mocks.retainedCharacterService.getCurrentProjection.mockResolvedValue({
      characterId: "char-1",
      characterRevisionId: "revision-1",
      effectiveSkills: { rows: [] },
      perspective: "owner",
      provenanceDetail: "owner_safe",
    });

    const app = await buildCharactersTestApp();
    const response = await app.inject({ method: "GET", url: "/char-1/effective-skills" });

    expect(response.statusCode).toBe(200);
    expect(mocks.retainedCharacterService.getCurrentProjection).toHaveBeenCalledWith({
      characterId: "char-1",
      perspective: "owner",
    });
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
      new CharacterValidationError(["Name already taken."]),
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

  it("updates an accessible character only against the supplied server revision", async () => {
    mocks.loadAccessibleCharacterInApi.mockResolvedValue(stubCharacter);
    mocks.characterService.saveExistingCharacter.mockResolvedValue({
      ...stubCharacter,
      updatedAt: "2026-01-01T01:00:00.000Z",
    });

    const app = await buildCharactersTestApp();
    const response = await app.inject({
      method: "PUT",
      url: "/char-1",
      payload: {
        build: stubCharacter.build,
        expectedUpdatedAt: stubCharacter.updatedAt,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.characterService.saveExistingCharacter).toHaveBeenCalledWith({
      build: stubCharacter.build,
      characterId: "char-1",
      expectedUpdatedAt: stubCharacter.updatedAt,
    });
  });

  it("requires an explicit server revision for updates", async () => {
    const app = await buildCharactersTestApp();
    const response = await app.inject({
      method: "PUT",
      url: "/char-1",
      payload: { build: stubCharacter.build },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "A valid expectedUpdatedAt character revision is required.",
    });
    expect(mocks.characterService.saveExistingCharacter).not.toHaveBeenCalled();
  });

  it("returns the current canonical record when a stale update conflicts", async () => {
    const { CharacterMutationConflictError } = await import("@glantri/database");
    const currentCharacter = {
      ...stubCharacter,
      name: "Newer server character",
      updatedAt: "2026-01-01T02:00:00.000Z",
    };
    mocks.loadAccessibleCharacterInApi.mockResolvedValue(currentCharacter);
    mocks.characterService.saveExistingCharacter.mockRejectedValue(
      new CharacterMutationConflictError(
        "stale_character",
        "The character changed on the server. Reload it before saving this draft.",
        currentCharacter as never,
      ),
    );

    const app = await buildCharactersTestApp();
    const response = await app.inject({
      method: "PUT",
      url: "/char-1",
      payload: {
        build: stubCharacter.build,
        expectedUpdatedAt: stubCharacter.updatedAt,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "stale_character",
      currentCharacter,
      error: "The character changed on the server. Reload it before saving this draft.",
    });
  });

  it("deletes an accessible character only at the supplied server revision", async () => {
    mocks.loadAccessibleCharacterInApi.mockResolvedValue(stubCharacter);
    mocks.characterService.deleteExistingCharacter.mockResolvedValue(stubCharacter);

    const app = await buildCharactersTestApp();
    const response = await app.inject({
      method: "DELETE",
      url: "/char-1",
      payload: { expectedUpdatedAt: stubCharacter.updatedAt },
    });

    expect(response.statusCode).toBe(204);
    expect(mocks.characterService.deleteExistingCharacter).toHaveBeenCalledWith({
      characterId: "char-1",
      expectedUpdatedAt: stubCharacter.updatedAt,
    });
  });
});

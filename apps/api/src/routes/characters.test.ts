import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const authenticatedUser = {
    email: "player@example.test",
    id: "player-1",
    roles: ["player"]
  };
  const characterService = {
    listCharacters: vi.fn(),
    saveCharacter: vi.fn(),
    saveExistingCharacter: vi.fn()
  };
  return {
    authenticatedUser,
    characterService,
    requireAuthenticatedUser: vi.fn()
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
  }
}));

vi.mock("../lib/sessionAuth", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser
}));

vi.mock("../lib/characterEditAccess", () => ({
  canEditCharacterInApi: vi.fn(() => false),
  loadAccessibleCharacterInApi: vi.fn()
}));

import { loadAccessibleCharacterInApi } from "../lib/characterEditAccess";
import { charactersRoutes } from "./characters";

async function buildCharactersTestApp() {
  const app = Fastify({ logger: false });
  await app.register(charactersRoutes);
  return app;
}

const validProfile = {
  id: "profile-1",
  label: "A",
  distractionLevel: 4,
  rolledStats: { str: 10, dex: 10, con: 10, health: 10, siz: 10, com: 10, cha: 10, int: 10, pow: 10, lck: 10, will: 10 }
};

describe("characters route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.authenticatedUser);
  });

  describe("GET /:id", () => {
    it("returns 404 with standard error shape when character is not found", async () => {
      vi.mocked(loadAccessibleCharacterInApi).mockResolvedValue(null);
      const app = await buildCharactersTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/character-missing"
      });

      await app.close();

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Character not found." });
    });

    it("returns the character when found", async () => {
      const character = { id: "char-1", name: "Aldric" };
      vi.mocked(loadAccessibleCharacterInApi).mockResolvedValue(character as never);
      const app = await buildCharactersTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/char-1"
      });

      await app.close();

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ character });
    });
  });

  describe("POST /", () => {
    it("returns 400 with error and issues when CharacterValidationError is thrown", async () => {
      const { CharacterValidationError } = await import("@glantri/database");
      mocks.characterService.saveCharacter.mockRejectedValue(
        new CharacterValidationError(["Name already taken."])
      );
      const app = await buildCharactersTestApp();

      const response = await app.inject({
        method: "POST",
        payload: {
          build: {
            id: "char-new",
            name: "Aldric",
            profile: validProfile,
            professionId: "scholar",
            progression: {
              chargenMode: "standard",
              educationPoints: 0,
              flexiblePointFactor: 1,
              level: 1,
              primaryPoolSpent: 0,
              primaryPoolTotal: 50,
              secondaryPoolSpent: 0,
              secondaryPoolTotal: 0,
              skillGroups: [],
              skills: [],
              specializations: []
            },
            progressionState: { availablePoints: 0, checks: [], history: [], pendingAttempts: [] },
            equipment: { items: [] },
            chargenRuleSet: {
              exchangeCount: 2,
              flexiblePointFactor: 1,
              name: "Standard",
              ordinarySkillPoints: 50,
              statRollCount: 6
            }
          }
        },
        url: "/"
      });

      await app.close();

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "Character build validation failed.",
        issues: ["Name already taken."]
      });
    });

    it("returns 400 with standard error shape for generic validation errors", async () => {
      mocks.characterService.saveCharacter.mockRejectedValue(new Error("Build parse failed."));
      const app = await buildCharactersTestApp();

      const response = await app.inject({
        method: "POST",
        payload: { build: null },
        url: "/"
      });

      await app.close();

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body).toHaveProperty("error");
      expect(typeof body.error).toBe("string");
    });
  });

  describe("PUT /:id", () => {
    it("returns 400 with standard error shape when build id does not match route id", async () => {
      const app = await buildCharactersTestApp();

      const response = await app.inject({
        method: "PUT",
        payload: {
          build: {
            id: "different-id",
            name: "Aldric",
            profile: validProfile,
            professionId: "scholar",
            progression: {
              chargenMode: "standard",
              educationPoints: 0,
              flexiblePointFactor: 1,
              level: 1,
              primaryPoolSpent: 0,
              primaryPoolTotal: 50,
              secondaryPoolSpent: 0,
              secondaryPoolTotal: 0,
              skillGroups: [],
              skills: [],
              specializations: []
            },
            progressionState: { availablePoints: 0, checks: [], history: [], pendingAttempts: [] },
            equipment: { items: [] },
            chargenRuleSet: {
              exchangeCount: 2,
              flexiblePointFactor: 1,
              name: "Standard",
              ordinarySkillPoints: 50,
              statRollCount: 6
            }
          }
        },
        url: "/char-1"
      });

      await app.close();

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "Character id does not match build id." });
    });
  });
});

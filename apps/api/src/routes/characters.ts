import type { FastifyPluginAsync, FastifyReply } from "fastify";

import {
  CharacterMutationConflictError,
  CharacterService,
  CharacterValidationError,
} from "@glantri/database";
import { characterBuildSchema } from "@glantri/domain";

import { requireAuthenticatedUser } from "../lib/sessionAuth";
import { loadAccessibleCharacterInApi } from "../lib/characterEditAccess";
import { BadRequestError, NotFoundError, handleRouteError } from "../lib/errors";

const characterService = new CharacterService();

function parseExpectedUpdatedAt(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new BadRequestError("A valid expectedUpdatedAt character revision is required.");
  }

  return value;
}

function handleCharacterMutationError(error: unknown, reply: FastifyReply) {
  if (error instanceof CharacterMutationConflictError) {
    return reply.code(409).send({
      code: error.code,
      currentCharacter: error.currentCharacter,
      error: error.message,
    });
  }

  if (error instanceof CharacterValidationError) {
    return handleRouteError(
      new BadRequestError("Character build validation failed.", { issues: error.issues }),
      reply,
    );
  }

  return handleRouteError(error, reply);
}

export const charactersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const characters = await characterService.listAccessibleCharacters({
      isAdmin: user.roles.includes("admin"),
      isGameMaster: user.roles.includes("game_master"),
      userId: user.id,
    });

    return {
      characters,
    };
  });

  app.get("/:id", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      const characterId = (request.params as { id?: string }).id;

      if (!characterId) {
        throw new BadRequestError("Character id is required.");
      }

      const character = await loadAccessibleCharacterInApi({
        characterId,
        characterService,
        user,
      });

      if (!character) {
        throw new NotFoundError("Character not found.");
      }

      return {
        character,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      const payload = request.body as { build?: unknown };
      const build = characterBuildSchema.parse(payload.build);
      const character = await characterService.saveCharacter({
        build,
        id: build.id,
        level: build.progression.level,
        name: build.name,
        ownerId: user.id,
      });

      return {
        character,
      };
    } catch (error) {
      return handleCharacterMutationError(error, reply);
    }
  });

  app.put("/:id", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      const characterId = (request.params as { id?: string }).id;

      if (!characterId) {
        throw new BadRequestError("Character id is required.");
      }

      const payload = request.body as { build?: unknown; expectedUpdatedAt?: unknown };
      const build = characterBuildSchema.parse(payload.build);

      if (build.id !== characterId) {
        throw new BadRequestError("Character id does not match build id.");
      }

      const expectedUpdatedAt = parseExpectedUpdatedAt(payload.expectedUpdatedAt);

      const accessibleCharacter = await loadAccessibleCharacterInApi({
        characterId,
        characterService,
        user,
      });

      if (!accessibleCharacter) {
        throw new NotFoundError("Character not found.");
      }

      const character = await characterService.saveExistingCharacter({
        build,
        characterId,
        expectedUpdatedAt,
      });

      if (!character) {
        throw new NotFoundError("Character not found.");
      }

      return {
        character,
      };
    } catch (error) {
      return handleCharacterMutationError(error, reply);
    }
  });

  app.delete("/:id", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      const characterId = (request.params as { id?: string }).id;

      if (!characterId) {
        throw new BadRequestError("Character id is required.");
      }

      const payload = request.body as { expectedUpdatedAt?: unknown };
      const expectedUpdatedAt = parseExpectedUpdatedAt(payload?.expectedUpdatedAt);
      const accessibleCharacter = await loadAccessibleCharacterInApi({
        characterId,
        characterService,
        user,
      });

      if (!accessibleCharacter) {
        throw new NotFoundError("Character not found.");
      }

      const deletedCharacter = await characterService.deleteExistingCharacter({
        characterId,
        expectedUpdatedAt,
      });

      if (!deletedCharacter) {
        throw new NotFoundError("Character not found.");
      }

      return reply.code(204).send();
    } catch (error) {
      return handleCharacterMutationError(error, reply);
    }
  });
};

import type { FastifyPluginAsync } from "fastify";

import { CharacterService, CharacterValidationError } from "@glantri/database";
import { characterBuildSchema } from "@glantri/domain";

import { requireAuthenticatedUser } from "../lib/sessionAuth";
import { canEditCharacterInApi, loadAccessibleCharacterInApi } from "../lib/characterEditAccess";
import { BadRequestError, NotFoundError, handleRouteError } from "../lib/errors";

const characterService = new CharacterService();

export const charactersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const characters = canEditCharacterInApi(user)
      ? await characterService.listCharacters()
      : await characterService.listCharacters(user.id);

    return {
      characters
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
        user
      });

      if (!character) {
        throw new NotFoundError("Character not found.");
      }

      return {
        character
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
        ownerId: user.id
      });

      return {
        character
      };
    } catch (error) {
      if (error instanceof CharacterValidationError) {
        return handleRouteError(
          new BadRequestError("Character build validation failed.", { issues: error.issues }),
          reply
        );
      }
      return handleRouteError(error, reply);
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

      const payload = request.body as { build?: unknown };
      const build = characterBuildSchema.parse(payload.build);

      if (build.id !== characterId) {
        throw new BadRequestError("Character id does not match build id.");
      }

      const accessibleCharacter = await loadAccessibleCharacterInApi({
        characterId,
        characterService,
        user
      });

      if (!accessibleCharacter) {
        throw new NotFoundError("Character not found.");
      }

      const character = await characterService.saveExistingCharacter({
        build,
        characterId
      });

      if (!character) {
        throw new NotFoundError("Character not found.");
      }

      return {
        character
      };
    } catch (error) {
      if (error instanceof CharacterValidationError) {
        return handleRouteError(
          new BadRequestError("Character build validation failed.", { issues: error.issues }),
          reply
        );
      }
      return handleRouteError(error, reply);
    }
  });
};

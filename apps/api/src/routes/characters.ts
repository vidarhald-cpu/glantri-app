import type { FastifyPluginAsync } from "fastify";

import { CharacterService, CharacterValidationError } from "@glantri/database";
import { characterBuildSchema } from "@glantri/domain";

import { requireAuthenticatedUser } from "../lib/sessionAuth";

const characterService = new CharacterService();

export const charactersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const characters = await characterService.listCharacters(user.id);

    return {
      characters
    };
  });

  app.post("/", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const payload = request.body as { build?: unknown };
    const build = characterBuildSchema.parse(payload.build);

    try {
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
        return reply.code(400).send({
          error: "Character build validation failed.",
          issues: error.issues
        });
      }

      throw error;
    }
  });
};

import type { FastifyPluginAsync, FastifyReply } from "fastify";

import {
  CharacterMutationConflictError,
  CharacterService,
  CharacterValidationError,
  RetainedCharacterMutationError,
  RetainedCharacterService,
} from "@glantri/database";
import {
  characterBuildSchema,
  type CharacterMigrationPreview,
  type CharacterVersionEnvelope,
} from "@glantri/domain";

import { requireAuthenticatedUser } from "../lib/sessionAuth";
import { loadAccessibleCharacterInApi } from "../lib/characterEditAccess";
import { BadRequestError, NotFoundError, handleRouteError } from "../lib/errors";

const characterService = new CharacterService();
const retainedCharacterService = new RetainedCharacterService();

function parseExpectedUpdatedAt(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new BadRequestError("A valid expectedUpdatedAt character revision is required.");
  }

  return value;
}

function handleCharacterMutationError(error: unknown, reply: FastifyReply) {
  if (error instanceof RetainedCharacterMutationError) {
    const status = error.code === "retained_character_unauthorized" ? 404 : 409;
    return reply.code(status).send({
      code: error.code,
      currentRevisionId: error.currentRevisionId,
      error: error.message,
    });
  }
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

  app.get("/:id/effective-skills", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      const characterId = (request.params as { id?: string }).id;
      if (!characterId) throw new BadRequestError("Character id is required.");
      const character = await loadAccessibleCharacterInApi({ characterId, characterService, user });
      if (!character) throw new NotFoundError("Character not found.");
      const perspective = user.roles.includes("admin")
        ? "admin"
        : character.ownerId === user.id
          ? "owner"
          : "current_campaign_gm";
      const retainedCharacter = await retainedCharacterService.getCurrentProjection({
        characterId,
        perspective,
      });
      if (!retainedCharacter) throw new NotFoundError("Retained Character revision not found.");
      return { retainedCharacter };
    } catch (error) {
      return handleCharacterMutationError(error, reply);
    }
  });

  app.post("/:id/histories/:historyInstanceId/advance", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      const params = request.params as { historyInstanceId?: string; id?: string };
      const body = request.body as Record<string, unknown>;
      if (!params.id || !params.historyInstanceId)
        throw new BadRequestError("Character and history ids are required.");
      const revision = await retainedCharacterService.advanceLearningHistory({
        actor: { isAdmin: user.roles.includes("admin"), userId: user.id },
        characterId: params.id,
        expectedRevisionId: String(body.expectedRevisionId ?? ""),
        historyInstanceId: params.historyInstanceId,
        idempotencyKey: String(body.idempotencyKey ?? ""),
        reason: String(body.reason ?? "Learning history advanced."),
        targetLevel: Number(body.targetLevel),
      });
      return { revision };
    } catch (error) {
      return handleCharacterMutationError(error, reply);
    }
  });

  app.post("/:id/profession", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      const characterId = (request.params as { id?: string }).id;
      const body = request.body as Record<string, unknown>;
      if (!characterId) throw new BadRequestError("Character id is required.");
      const revision = await retainedCharacterService.changeProfessionContext({
        actor: { isAdmin: user.roles.includes("admin"), userId: user.id },
        characterId,
        expectedRevisionId: String(body.expectedRevisionId ?? ""),
        idempotencyKey: String(body.idempotencyKey ?? ""),
        professionId: String(body.professionId ?? ""),
        reason: String(body.reason ?? "Profession context changed."),
      });
      return { revision };
    } catch (error) {
      return handleCharacterMutationError(error, reply);
    }
  });

  app.post("/:id/migrations/preview", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      const characterId = (request.params as { id?: string }).id;
      const body = request.body as Record<string, unknown>;
      if (!characterId) throw new BadRequestError("Character id is required.");
      const preview = await retainedCharacterService.previewMigration({
        actor: { isAdmin: user.roles.includes("admin"), userId: user.id },
        characterId,
        expectedRevisionId: String(body.expectedRevisionId ?? ""),
        migrationId: String(body.migrationId ?? ""),
        targetEnvelope: body.targetEnvelope as CharacterVersionEnvelope,
      });
      return { preview };
    } catch (error) {
      return handleCharacterMutationError(error, reply);
    }
  });

  app.post("/:id/migrations/apply", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      const body = request.body as Record<string, unknown>;
      const revision = await retainedCharacterService.applyMigration({
        actor: { isAdmin: user.roles.includes("admin"), userId: user.id },
        idempotencyKey: String(body.idempotencyKey ?? ""),
        preview: body.preview as CharacterMigrationPreview,
      });
      return { revision };
    } catch (error) {
      return handleCharacterMutationError(error, reply);
    }
  });

  app.post("/:id/migrations/rollback", async (request, reply) => {
    try {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      const characterId = (request.params as { id?: string }).id;
      const body = request.body as Record<string, unknown>;
      if (!characterId) throw new BadRequestError("Character id is required.");
      const revision = await retainedCharacterService.rollbackMigration({
        actor: { isAdmin: user.roles.includes("admin"), userId: user.id },
        characterId,
        expectedRevisionId: String(body.expectedRevisionId ?? ""),
        idempotencyKey: String(body.idempotencyKey ?? ""),
        migrationRevisionId: String(body.migrationRevisionId ?? ""),
      });
      return { revision };
    } catch (error) {
      return handleCharacterMutationError(error, reply);
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

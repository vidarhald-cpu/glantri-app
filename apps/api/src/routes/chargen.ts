import type { FastifyPluginAsync } from "fastify";

import {
  chargenRuleSetParametersSchema,
  headlessChargenFinalizeInputSchema,
} from "@glantri/domain";
import {
  ChargenRuleSetService,
  CharacterValidationError,
  RetainedCharacterMutationError,
  RetainedCharacterService,
} from "@glantri/database";

import { requireAdminUser, requireAuthenticatedUser } from "../lib/sessionAuth";
import { BadRequestError, NotFoundError, handleRouteError } from "../lib/errors";

const chargenRuleSetService = new ChargenRuleSetService();
const retainedCharacterService = new RetainedCharacterService();

export const chargenRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({
    resource: "chargen",
    status: "scaffolded",
  }));

  app.get("/rule-sets", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    return chargenRuleSetService.getStore();
  });

  app.post("/headless/finalize", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) return;

    try {
      const parsed = headlessChargenFinalizeInputSchema.parse(request.body);
      const result = await retainedCharacterService.finalizeHeadlessProjected({
        actor: { isAdmin: user.roles.includes("admin"), userId: user.id },
        command: parsed as never,
      });
      return result;
    } catch (error) {
      if (error instanceof RetainedCharacterMutationError) {
        if (error.code === "retained_character_unauthorized") {
          return reply.code(404).send({ code: error.code, error: "Character not found." });
        }
        return reply.code(409).send({
          code: error.code,
          currentRevisionId: error.currentRevisionId,
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
  });

  app.get("/rule-sets/active", async () => {
    const store = await chargenRuleSetService.getStore();

    return {
      activeRuleSet: store.activeRuleSet,
    };
  });

  app.post("/rule-sets", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    const payload = request.body as {
      name?: unknown;
      parameters?: unknown;
    };
    const name = typeof payload.name === "string" ? payload.name : "";
    const parameters = chargenRuleSetParametersSchema.parse(payload.parameters);

    return chargenRuleSetService.createRuleSet({
      name,
      parameters,
    });
  });

  app.post("/rule-sets/:id/activate", async (request, reply) => {
    try {
      const user = await requireAdminUser(request, reply);

      if (!user) {
        return;
      }

      const id = (request.params as { id?: string }).id;

      if (!id) {
        throw new BadRequestError("Rule set id is required.");
      }

      return await chargenRuleSetService.activateRuleSet(id);
    } catch (error) {
      if (error instanceof Error && error.message === "Chargen rule set not found.") {
        return handleRouteError(new NotFoundError(error.message), reply);
      }
      return handleRouteError(error, reply);
    }
  });
};

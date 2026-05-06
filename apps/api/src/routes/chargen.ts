import type { FastifyPluginAsync } from "fastify";

import { chargenRuleSetParametersSchema } from "@glantri/domain";
import { ChargenRuleSetService } from "@glantri/database";

import { requireAdminUser, requireAuthenticatedUser } from "../lib/sessionAuth";

const chargenRuleSetService = new ChargenRuleSetService();

export const chargenRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({
    resource: "chargen",
    status: "scaffolded"
  }));

  app.get("/rule-sets", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    return chargenRuleSetService.getStore();
  });

  app.get("/rule-sets/active", async () => {
    const store = await chargenRuleSetService.getStore();

    return {
      activeRuleSet: store.activeRuleSet
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
      parameters
    });
  });

  app.post("/rule-sets/:id/activate", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    const id = (request.params as { id?: string }).id;

    if (!id) {
      return reply.code(400).send({
        error: "Rule set id is required."
      });
    }

    try {
      return await chargenRuleSetService.activateRuleSet(id);
    } catch (error) {
      if (error instanceof Error && error.message === "Chargen rule set not found.") {
        return reply.code(404).send({
          error: error.message
        });
      }

      throw error;
    }
  });
};

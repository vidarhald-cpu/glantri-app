import type { FastifyPluginAsync } from "fastify";

import { campaignRoutes } from "./scenarios/campaignRoutes";
import { campaignItemRoutes } from "./scenarios/campaignItemRoutes";
import { combatItemInteractionRoutes } from "./scenarios/combatItemInteractionRoutes";
import { encounterRoutes } from "./scenarios/encounterRoutes";
import { participantRoutes } from "./scenarios/participantRoutes";
import { scenarioRoutes } from "./scenarios/scenarioRoutes";
import { templateRoutes } from "./scenarios/templateRoutes";
import { runScenarioWorkspaceAccessRequest } from "./scenarios/access";

export const scenariosRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", (request, _reply, done) => {
    runScenarioWorkspaceAccessRequest(request.method, done);
  });

  await app.register(templateRoutes);
  await app.register(campaignRoutes);
  await app.register(campaignItemRoutes);
  await app.register(combatItemInteractionRoutes);
  await app.register(scenarioRoutes);
  await app.register(encounterRoutes);
  await app.register(participantRoutes);
};

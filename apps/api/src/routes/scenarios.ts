import type { FastifyPluginAsync } from "fastify";

import { campaignRoutes } from "./scenarios/campaignRoutes";
import { encounterRoutes } from "./scenarios/encounterRoutes";
import { participantRoutes } from "./scenarios/participantRoutes";
import { scenarioRoutes } from "./scenarios/scenarioRoutes";
import { templateRoutes } from "./scenarios/templateRoutes";

export const scenariosRoutes: FastifyPluginAsync = async (app) => {
  await app.register(templateRoutes);
  await app.register(campaignRoutes);
  await app.register(scenarioRoutes);
  await app.register(encounterRoutes);
  await app.register(participantRoutes);
};

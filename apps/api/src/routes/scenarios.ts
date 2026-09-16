import type { FastifyPluginAsync } from "fastify";

import { artifactImportRoutes } from "./artifactImports";
import { artifactRoutes } from "./artifacts";
import { campaignRoutes } from "./scenarios/campaignRoutes";
import { campaignItemRoutes } from "./scenarios/campaignItemRoutes";
import { blackboardRoutes } from "./scenarios/blackboardRoutes";
import { combatItemInteractionRoutes } from "./scenarios/combatItemInteractionRoutes";
import { encounterRoutes } from "./scenarios/encounterRoutes";
import { participantRoutes } from "./scenarios/participantRoutes";
import { scenarioRoutes } from "./scenarios/scenarioRoutes";
import { templateRoutes } from "./scenarios/templateRoutes";

export const scenariosRoutes: FastifyPluginAsync = async (app) => {
  await app.register(artifactRoutes);
  await app.register(artifactImportRoutes);
  await app.register(templateRoutes);
  await app.register(campaignRoutes);
  await app.register(blackboardRoutes);
  await app.register(campaignItemRoutes);
  await app.register(combatItemInteractionRoutes);
  await app.register(scenarioRoutes);
  await app.register(encounterRoutes);
  await app.register(participantRoutes);
};

import type { FastifyPluginAsync } from "fastify";
import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
} from "@glantri/database";
import { requireAuthenticatedUser } from "../../lib/sessionAuth";
import { handleRouteError } from "../../lib/errors";
import { requireAccessibleCharacter } from "./access";
import { loadDevSampleCharacterEquipment, toEquipmentFeatureState } from "./helpers";
import { parseBootstrapSampleBody, parseCharacterId } from "./parse";

const equipmentReadModelService = new CharacterEquipmentReadModelService();
const equipmentWriteService = new CharacterEquipmentWriteService();

const isProduction = process.env.NODE_ENV === "production";

export const equipmentDevRoutes: FastifyPluginAsync = async (app) => {
  app.post("/:id/equipment/bootstrap-sample", async (request, reply) => {
    if (isProduction) {
      return reply.code(404).send({ error: "Not found." });
    }

    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseBootstrapSampleBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.bootstrapSampleCharacterEquipment(
        id,
        await loadDevSampleCharacterEquipment(),
        { overwrite: body.overwrite }
      );

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        ),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
};

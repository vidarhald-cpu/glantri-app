import type { FastifyPluginAsync } from "fastify";
import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
} from "@glantri/database";
import { requireAuthenticatedUser } from "../../lib/sessionAuth";
import { requireAccessibleCharacter } from "./access";
import { toEquipmentFeatureState } from "./helpers";
import {
  parseCharacterId,
  parseCreateLocationBody,
  parseDeleteLocationBody,
} from "./parse";

const equipmentReadModelService = new CharacterEquipmentReadModelService();
const equipmentWriteService = new CharacterEquipmentWriteService();

export const equipmentLocationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/:id/equipment/locations", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseCreateLocationBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.createCharacterStorageLocation(
        id,
        body.name,
        body.type,
        body.availabilityClass
      );

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        ),
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Character not found.") {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });

  app.post("/:id/equipment/locations/remove", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseDeleteLocationBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.removeCharacterStorageLocation(id, body.locationId);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        ),
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Character not found.") {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });
};

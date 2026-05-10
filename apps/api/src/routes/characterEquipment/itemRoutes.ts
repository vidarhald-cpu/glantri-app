import type { FastifyPluginAsync } from "fastify";
import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
} from "@glantri/database";
import { requireAuthenticatedUser } from "../../lib/sessionAuth";
import { requireAccessibleCharacter } from "./access";
import { toEquipmentFeatureState } from "./helpers";
import {
  parseAddItemBody,
  parseCharacterId,
  parseMoveItemBody,
  parseRemoveItemBody,
  parseUpdateMetadataBody,
  parseUpdateQuantityBody,
} from "./parse";

const equipmentReadModelService = new CharacterEquipmentReadModelService();
const equipmentWriteService = new CharacterEquipmentWriteService();

export const equipmentItemRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:id/equipment", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.ensureCharacterEquipmentInitialized(id);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        ),
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Character not found.") {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  });

  app.post("/:id/equipment/move", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseMoveItemBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.moveCharacterEquipmentItem(
        id,
        body.itemId,
        body.locationId,
        body.carryMode
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

  app.post("/:id/equipment/items", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseAddItemBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.addCharacterEquipmentItem(id, body);

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

  app.post("/:id/equipment/items/remove", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseRemoveItemBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.removeCharacterEquipmentItem(id, body.itemId);

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

  app.post("/:id/equipment/items/quantity", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseUpdateQuantityBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.updateCharacterEquipmentQuantity(id, body.itemId, body.quantity);

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

  app.post("/:id/equipment/items/metadata", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseUpdateMetadataBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.updateCharacterEquipmentMetadata(id, body.itemId, {
        conditionState: body.conditionState,
        displayName: body.displayName,
        isFavorite: body.isFavorite,
        notes: body.notes,
      });

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

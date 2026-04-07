import type { FastifyPluginAsync } from "fastify";

import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
  CharacterService
} from "@glantri/database";
import { CarryModeSchema, StorageLocationTypeSchema } from "@glantri/domain/equipment";

import { requireAuthenticatedUser } from "../lib/sessionAuth";

const characterService = new CharacterService();
const equipmentReadModelService = new CharacterEquipmentReadModelService();
const equipmentWriteService = new CharacterEquipmentWriteService();

function parseCharacterId(params: unknown): string {
  const id =
    params && typeof params === "object" && "id" in params ? params.id : undefined;

  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Character id is required.");
  }

  return id;
}

function parseMoveItemBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Move payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;
  const locationId = "locationId" in body ? body.locationId : undefined;
  const carryMode = "carryMode" in body ? body.carryMode : undefined;

  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new Error("itemId is required.");
  }

  if (typeof locationId !== "string" || locationId.length === 0) {
    throw new Error("locationId is required.");
  }

  return {
    carryMode: CarryModeSchema.parse(carryMode),
    itemId,
    locationId
  };
}

function parseCreateLocationBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Location payload is required.");
  }

  const name = "name" in body ? body.name : undefined;
  const type = "type" in body ? body.type : undefined;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Location name is required.");
  }

  return {
    name,
    type: StorageLocationTypeSchema.parse(type)
  };
}

async function requireOwnedCharacter(
  ownerId: string,
  characterId: string
) {
  const character = await characterService.getOwnedCharacter(ownerId, characterId);

  if (!character) {
    throw new Error("Character not found.");
  }
}

function toEquipmentFeatureState(state: Awaited<
  ReturnType<CharacterEquipmentReadModelService["getCharacterEquipmentState"]>
>) {
  return {
    activeLoadoutByCharacterId: state.activeLoadoutByCharacterId,
    itemsById: state.itemsById,
    locationsById: state.locationsById,
    templates: {
      templatesById: state.templatesById
    }
  };
}

export const characterEquipmentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:id/equipment", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      await requireOwnedCharacter(user.id, id);
      await equipmentWriteService.ensureCharacterEquipmentInitialized(id);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        )
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Character not found.") {
        return reply.code(404).send({
          error: error.message
        });
      }

      throw error;
    }
  });

  app.post("/:id/equipment/move", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseMoveItemBody(request.body);
      await requireOwnedCharacter(user.id, id);
      await equipmentWriteService.moveCharacterEquipmentItem(
        id,
        body.itemId,
        body.locationId,
        body.carryMode
      );

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        )
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Character not found.") {
        return reply.code(404).send({
          error: error.message
        });
      }

      if (error instanceof Error) {
        return reply.code(400).send({
          error: error.message
        });
      }

      throw error;
    }
  });

  app.post("/:id/equipment/locations", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseCreateLocationBody(request.body);
      await requireOwnedCharacter(user.id, id);
      await equipmentWriteService.createCharacterStorageLocation(id, body.name, body.type);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        )
      };
    } catch (error) {
      if (error instanceof Error && error.message === "Character not found.") {
        return reply.code(404).send({
          error: error.message
        });
      }

      if (error instanceof Error) {
        return reply.code(400).send({
          error: error.message
        });
      }

      throw error;
    }
  });
};

import type { FastifyPluginAsync } from "fastify";

import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
  CharacterService,
  type ActiveWeaponSlot
} from "@glantri/database";
import {
  CarryModeSchema,
  ItemConditionStateSchema,
  LocationAvailabilityClassSchema,
  MaterialTypeSchema,
  QualityTypeSchema,
  StorageLocationTypeSchema
} from "@glantri/domain/equipment";

import { loadAccessibleCharacterInApi } from "../lib/characterEditAccess";
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
  const availabilityClass = "availabilityClass" in body ? body.availabilityClass : undefined;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Location name is required.");
  }

  return {
    availabilityClass: LocationAvailabilityClassSchema.parse(availabilityClass),
    name,
    type: StorageLocationTypeSchema.parse(type)
  };
}

function parseDeleteLocationBody(body: unknown): { locationId: string } {
  if (!body || typeof body !== "object") {
    throw new Error("Delete location payload is required.");
  }

  const locationId = "locationId" in body ? body.locationId : undefined;

  if (typeof locationId !== "string" || locationId.length === 0) {
    throw new Error("locationId is required.");
  }

  return { locationId };
}

function parseNullableItemIdBody(body: unknown): { itemId: string | null } {
  if (!body || typeof body !== "object") {
    throw new Error("Loadout payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;

  if (itemId !== null && itemId !== undefined && typeof itemId !== "string") {
    throw new Error("itemId must be a string or null.");
  }

  return {
    itemId: typeof itemId === "string" && itemId.length === 0 ? null : (itemId ?? null)
  };
}

function parseBootstrapSampleBody(body: unknown): { overwrite: boolean } {
  if (body == null) {
    return { overwrite: false };
  }

  if (typeof body !== "object") {
    throw new Error("Bootstrap payload must be an object.");
  }

  const overwrite = "overwrite" in body ? body.overwrite : undefined;

  if (overwrite !== undefined && typeof overwrite !== "boolean") {
    throw new Error("overwrite must be a boolean when provided.");
  }

  return {
    overwrite: overwrite ?? false
  };
}

function parseAddItemBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Add item payload is required.");
  }

  const templateId = "templateId" in body ? body.templateId : undefined;
  const quantity = "quantity" in body ? body.quantity : undefined;
  const initialLocationId = "initialLocationId" in body ? body.initialLocationId : undefined;
  const initialCarryMode = "initialCarryMode" in body ? body.initialCarryMode : undefined;
  const material = "material" in body ? body.material : undefined;
  const quality = "quality" in body ? body.quality : undefined;
  const displayName = "displayName" in body ? body.displayName : undefined;
  const notes = "notes" in body ? body.notes : undefined;

  if (typeof templateId !== "string" || templateId.length === 0) {
    throw new Error("templateId is required.");
  }

  if (typeof initialLocationId !== "string" || initialLocationId.length === 0) {
    throw new Error("initialLocationId is required.");
  }

  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    throw new Error("quantity must be a number.");
  }

  if (displayName !== undefined && displayName !== null && typeof displayName !== "string") {
    throw new Error("displayName must be a string when provided.");
  }

  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    throw new Error("notes must be a string when provided.");
  }

  return {
    displayName: displayName ?? null,
    initialCarryMode: CarryModeSchema.parse(initialCarryMode),
    initialLocationId,
    material: material == null ? undefined : MaterialTypeSchema.parse(material),
    notes: notes ?? null,
    quality: quality == null ? undefined : QualityTypeSchema.parse(quality),
    quantity,
    templateId
  };
}

function parseRemoveItemBody(body: unknown): { itemId: string } {
  if (!body || typeof body !== "object") {
    throw new Error("Remove item payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;

  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new Error("itemId is required.");
  }

  return { itemId };
}

function parseUpdateQuantityBody(body: unknown): { itemId: string; quantity: number } {
  if (!body || typeof body !== "object") {
    throw new Error("Quantity payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;
  const quantity = "quantity" in body ? body.quantity : undefined;

  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new Error("itemId is required.");
  }

  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    throw new Error("quantity must be a number.");
  }

  return { itemId, quantity };
}

function parseUpdateMetadataBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Metadata payload is required.");
  }

  const itemId = "itemId" in body ? body.itemId : undefined;
  const displayName = "displayName" in body ? body.displayName : undefined;
  const conditionState = "conditionState" in body ? body.conditionState : undefined;
  const notes = "notes" in body ? body.notes : undefined;
  const isFavorite = "isFavorite" in body ? body.isFavorite : undefined;

  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new Error("itemId is required.");
  }

  if (displayName !== undefined && displayName !== null && typeof displayName !== "string") {
    throw new Error("displayName must be a string when provided.");
  }

  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    throw new Error("notes must be a string when provided.");
  }

  if (isFavorite !== undefined && isFavorite !== null && typeof isFavorite !== "boolean") {
    throw new Error("isFavorite must be a boolean when provided.");
  }

  return {
    conditionState: ItemConditionStateSchema.parse(conditionState),
    displayName: displayName ?? null,
    isFavorite: isFavorite ?? null,
    itemId,
    notes: notes ?? null
  };
}

async function requireAccessibleCharacter(
  user: { id: string; roles: string[] },
  characterId: string
) {
  const character = await loadAccessibleCharacterInApi({
    characterId,
    characterService,
    user
  });

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
      await requireAccessibleCharacter(user, id);
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

  app.post("/:id/equipment/locations/remove", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseDeleteLocationBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.removeCharacterStorageLocation(id, body.locationId);

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

  app.post("/:id/equipment/bootstrap-sample", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseBootstrapSampleBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.bootstrapSampleCharacterEquipment(id, {
        overwrite: body.overwrite
      });

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

  app.post("/:id/equipment/items", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseAddItemBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.addCharacterEquipmentItem(id, body);

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

  app.post("/:id/equipment/items/remove", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseRemoveItemBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.removeCharacterEquipmentItem(id, body.itemId);

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

  app.post("/:id/equipment/items/quantity", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseUpdateQuantityBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.updateCharacterEquipmentQuantity(id, body.itemId, body.quantity);

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

  app.post("/:id/equipment/items/metadata", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseUpdateMetadataBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.updateCharacterEquipmentMetadata(id, body.itemId, {
        conditionState: body.conditionState,
        displayName: body.displayName,
        isFavorite: body.isFavorite,
        notes: body.notes
      });

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

  app.post("/:id/equipment/loadout/worn-armor", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseNullableItemIdBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.setCharacterWornArmor(id, body.itemId);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        )
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

  app.post("/:id/equipment/loadout/ready-shield", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    const id = parseCharacterId(request.params);

    try {
      const body = parseNullableItemIdBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.setCharacterReadyShield(id, body.itemId);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        )
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

  async function registerWeaponSlotRoute(path: string, slot: ActiveWeaponSlot) {
    app.post(path, async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      const id = parseCharacterId(request.params);

      try {
        const body = parseNullableItemIdBody(request.body);
      await requireAccessibleCharacter(user, id);
        await equipmentWriteService.setCharacterActiveWeapon(id, slot, body.itemId);

        return {
          state: toEquipmentFeatureState(
            await equipmentReadModelService.getCharacterEquipmentState(id)
          )
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
  }

  await registerWeaponSlotRoute("/:id/equipment/loadout/active-primary-weapon", "primary");
  await registerWeaponSlotRoute("/:id/equipment/loadout/active-secondary-weapon", "secondary");
  await registerWeaponSlotRoute("/:id/equipment/loadout/active-missile-weapon", "missile");
};

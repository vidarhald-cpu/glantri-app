import type { FastifyPluginAsync } from "fastify";
import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
  StaleCharacterEquipmentAggregateError,
} from "@glantri/database";
import { requireAuthenticatedUser } from "../../lib/sessionAuth";
import { ConflictError, handleRouteError } from "../../lib/errors";
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
      const viewer = await requireAccessibleCharacter(user, id);
      await equipmentWriteService.ensureCharacterEquipmentInitialized(id);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id, viewer),
        ),
      };
    } catch (error) {
      return handleRouteError(
        error instanceof StaleCharacterEquipmentAggregateError
          ? new ConflictError("Character equipment changed. Reload it before trying again.")
          : error,
        reply,
      );
    }
  });

  app.post("/:id/equipment/move", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseMoveItemBody(request.body);
      const viewer = await requireAccessibleCharacter(user, id);
      await equipmentWriteService.moveCharacterEquipmentItem(
        id,
        body.itemId,
        body.locationId,
        body.carryMode,
        body.expectedRevision,
      );

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id, viewer),
        ),
      };
    } catch (error) {
      return handleRouteError(
        error instanceof StaleCharacterEquipmentAggregateError
          ? new ConflictError("Character equipment changed. Reload it before trying again.")
          : error,
        reply,
      );
    }
  });

  app.post("/:id/equipment/items", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseAddItemBody(request.body);
      const viewer = await requireAccessibleCharacter(user, id);
      await equipmentWriteService.addCharacterEquipmentItem(id, body, body.expectedRevision);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id, viewer),
        ),
      };
    } catch (error) {
      return handleRouteError(
        error instanceof StaleCharacterEquipmentAggregateError
          ? new ConflictError("Character equipment changed. Reload it before trying again.")
          : error,
        reply,
      );
    }
  });

  app.post("/:id/equipment/items/remove", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseRemoveItemBody(request.body);
      const viewer = await requireAccessibleCharacter(user, id);
      await equipmentWriteService.removeCharacterEquipmentItem(
        id,
        body.itemId,
        body.expectedRevision,
      );

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id, viewer),
        ),
      };
    } catch (error) {
      return handleRouteError(
        error instanceof StaleCharacterEquipmentAggregateError
          ? new ConflictError("Character equipment changed. Reload it before trying again.")
          : error,
        reply,
      );
    }
  });

  app.post("/:id/equipment/items/quantity", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseUpdateQuantityBody(request.body);
      const viewer = await requireAccessibleCharacter(user, id);
      await equipmentWriteService.updateCharacterEquipmentQuantity(
        id,
        body.itemId,
        body.quantity,
        body.expectedRevision,
      );

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id, viewer),
        ),
      };
    } catch (error) {
      return handleRouteError(
        error instanceof StaleCharacterEquipmentAggregateError
          ? new ConflictError("Character equipment changed. Reload it before trying again.")
          : error,
        reply,
      );
    }
  });

  app.post("/:id/equipment/items/metadata", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseUpdateMetadataBody(request.body);
      const viewer = await requireAccessibleCharacter(user, id);
      await equipmentWriteService.updateCharacterEquipmentMetadata(
        id,
        body.itemId,
        {
          conditionState: body.conditionState,
          displayName: body.displayName,
          isFavorite: body.isFavorite,
          notes: body.notes,
        },
        body.expectedRevision,
      );

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id, viewer),
        ),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
};

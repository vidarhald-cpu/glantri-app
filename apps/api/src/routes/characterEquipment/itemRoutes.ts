import type { FastifyPluginAsync } from "fastify";
import {
  CharacterEquipmentReadModelService,
  CampaignService,
  CharacterEquipmentWriteService,
  StaleCharacterEquipmentAggregateError,
} from "@glantri/database";
import { requireAuthenticatedUser } from "../../lib/sessionAuth";
import { ConflictError, handleRouteError } from "../../lib/errors";
import { requireAccessibleCharacter, requireReadableCharacter } from "./access";
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
      const viewer = await requireReadableCharacter(user, id);
      await equipmentWriteService.ensureCharacterEquipmentInitialized(id);

      const managementCampaigns =
        viewer.kind === "gm"
          ? (await new CampaignService().listCampaignsByCharacterRosterAccess(id))
              .filter((campaign) => campaign.gmUserId === user.id)
              .map(({ id, name }) => ({ id, name }))
          : [];
      return {
        state: {
          ...toEquipmentFeatureState(
            await equipmentReadModelService.getCharacterEquipmentState(id, viewer),
          ),
          managementCampaigns,
        },
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
      const viewer = await requireAccessibleCharacter(user, id);
      const body = parseMoveItemBody(request.body);
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
      const viewer = await requireAccessibleCharacter(user, id);
      const body = parseAddItemBody(request.body);
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
      const viewer = await requireAccessibleCharacter(user, id);
      const body = parseRemoveItemBody(request.body);
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
      const viewer = await requireAccessibleCharacter(user, id);
      const body = parseUpdateQuantityBody(request.body);
      await equipmentWriteService.updateCharacterEquipmentQuantity(
        id,
        body.itemId,
        body.quantity,
        body.expectedRevision,
        {
          actorAuthority: viewer.kind === "gm" ? "campaign_gm" : "character_controller",
          actorUserId: user.id,
        },
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
      const viewer = await requireAccessibleCharacter(user, id);
      const body = parseUpdateMetadataBody(request.body);
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
      return handleRouteError(
        error instanceof StaleCharacterEquipmentAggregateError
          ? new ConflictError("Character equipment changed. Reload it before trying again.")
          : error,
        reply,
      );
    }
  });
};

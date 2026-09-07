import type { FastifyPluginAsync } from "fastify";
import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
  StaleCharacterEquipmentAggregateError,
  type ActiveWeaponSlot,
} from "@glantri/database";
import { requireAuthenticatedUser } from "../../lib/sessionAuth";
import { ConflictError, handleRouteError } from "../../lib/errors";
import { requireAccessibleCharacter } from "./access";
import { toEquipmentFeatureState } from "./helpers";
import { parseActiveAmmoBody, parseCharacterId, parseNullableItemIdBody } from "./parse";

const equipmentReadModelService = new CharacterEquipmentReadModelService();
const equipmentWriteService = new CharacterEquipmentWriteService();

export const equipmentLoadoutRoutes: FastifyPluginAsync = async (app) => {
  app.post("/:id/equipment/loadout/worn-armor", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseNullableItemIdBody(request.body);
      const viewer = await requireAccessibleCharacter(user, id);
      await equipmentWriteService.setCharacterWornArmor(id, body.itemId, body.expectedRevision);

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

  app.post("/:id/equipment/loadout/ready-shield", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseNullableItemIdBody(request.body);
      const viewer = await requireAccessibleCharacter(user, id);
      await equipmentWriteService.setCharacterReadyShield(id, body.itemId, body.expectedRevision);

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

  async function registerWeaponSlotRoute(path: string, slot: ActiveWeaponSlot) {
    app.post(path, async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;

      const id = parseCharacterId(request.params);

      try {
        const body = parseNullableItemIdBody(request.body);
        const viewer = await requireAccessibleCharacter(user, id);
        await equipmentWriteService.setCharacterActiveWeapon(
          id,
          slot,
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
  }

  await registerWeaponSlotRoute("/:id/equipment/loadout/active-primary-weapon", "primary");
  await registerWeaponSlotRoute("/:id/equipment/loadout/active-secondary-weapon", "secondary");
  await registerWeaponSlotRoute("/:id/equipment/loadout/active-missile-weapon", "missile");

  app.post("/:id/equipment/loadout/active-ammunition", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    const id = parseCharacterId(request.params);
    try {
      const body = parseActiveAmmoBody(request.body);
      const viewer = await requireAccessibleCharacter(user, id);
      await equipmentWriteService.setCharacterActiveAmmunition(
        id,
        body.itemIds,
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

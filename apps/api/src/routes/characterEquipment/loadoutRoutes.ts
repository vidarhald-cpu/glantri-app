import type { FastifyPluginAsync } from "fastify";
import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
  type ActiveWeaponSlot,
} from "@glantri/database";
import { requireAuthenticatedUser } from "../../lib/sessionAuth";
import { handleRouteError } from "../../lib/errors";
import { requireAccessibleCharacter } from "./access";
import { toEquipmentFeatureState } from "./helpers";
import { parseCharacterId, parseNullableItemIdBody } from "./parse";

const equipmentReadModelService = new CharacterEquipmentReadModelService();
const equipmentWriteService = new CharacterEquipmentWriteService();

export const equipmentLoadoutRoutes: FastifyPluginAsync = async (app) => {
  app.post("/:id/equipment/loadout/worn-armor", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseNullableItemIdBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.setCharacterWornArmor(id, body.itemId);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        ),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/:id/equipment/loadout/ready-shield", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    const id = parseCharacterId(request.params);

    try {
      const body = parseNullableItemIdBody(request.body);
      await requireAccessibleCharacter(user, id);
      await equipmentWriteService.setCharacterReadyShield(id, body.itemId);

      return {
        state: toEquipmentFeatureState(
          await equipmentReadModelService.getCharacterEquipmentState(id)
        ),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  async function registerWeaponSlotRoute(path: string, slot: ActiveWeaponSlot) {
    app.post(path, async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;

      const id = parseCharacterId(request.params);

      try {
        const body = parseNullableItemIdBody(request.body);
        await requireAccessibleCharacter(user, id);
        await equipmentWriteService.setCharacterActiveWeapon(id, slot, body.itemId);

        return {
          state: toEquipmentFeatureState(
            await equipmentReadModelService.getCharacterEquipmentState(id)
          ),
        };
      } catch (error) {
        return handleRouteError(error, reply);
      }
    });
  }

  await registerWeaponSlotRoute("/:id/equipment/loadout/active-primary-weapon", "primary");
  await registerWeaponSlotRoute("/:id/equipment/loadout/active-secondary-weapon", "secondary");
  await registerWeaponSlotRoute("/:id/equipment/loadout/active-missile-weapon", "missile");
};

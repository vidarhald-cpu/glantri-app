import type { FastifyPluginAsync } from "fastify";
import { equipmentDevRoutes } from "./devRoutes";
import { equipmentItemRoutes } from "./itemRoutes";
import { equipmentLoadoutRoutes } from "./loadoutRoutes";
import { equipmentLocationRoutes } from "./locationRoutes";
import { equipmentTransferRoutes } from "./transferRoutes";

export const characterEquipmentRoutes: FastifyPluginAsync = async (app) => {
  await app.register(equipmentItemRoutes);
  await app.register(equipmentLocationRoutes);
  await app.register(equipmentLoadoutRoutes);
  await app.register(equipmentTransferRoutes);
  await app.register(equipmentDevRoutes);
};

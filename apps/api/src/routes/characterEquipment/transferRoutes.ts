import type { FastifyPluginAsync } from "fastify";
import {
  CampaignService,
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
  StaleCharacterEquipmentAggregateError,
  CharacterService,
  StaleEquipmentTransferError,
} from "@glantri/database";

import { ConflictError, handleRouteError, NotFoundError } from "../../lib/errors";
import { requireAdminUser } from "../../lib/sessionAuth";
import { parseTransferItemBody } from "./parse";

function parsePathId(params: unknown, key: string, label: string): string {
  const value =
    params && typeof params === "object" && key in params
      ? (params as Record<string, unknown>)[key]
      : undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

export interface EquipmentTransferRouteServices {
  campaignService: CampaignService;
  characterService: CharacterService;
  readService: CharacterEquipmentReadModelService;
  writeService: CharacterEquipmentWriteService;
}

function defaultServices(): EquipmentTransferRouteServices {
  return {
    campaignService: new CampaignService(),
    characterService: new CharacterService(),
    readService: new CharacterEquipmentReadModelService(),
    writeService: new CharacterEquipmentWriteService(),
  };
}

export function createEquipmentTransferRoutes(
  configuredServices?: EquipmentTransferRouteServices,
): FastifyPluginAsync {
  return async (app) => {
    let resolvedServices = configuredServices;
    const services = () => (resolvedServices ??= defaultServices());

    async function requireCampaignAuthor(userId: string, roles: string[], campaignId: string) {
      const campaign = await services().campaignService.getCampaignById(campaignId);
      if (!campaign || (campaign.gmUserId !== userId && !roles.includes("admin"))) {
        throw new NotFoundError("Campaign not found.");
      }
    }

    async function campaignCharacters(campaignId: string) {
      const current = services();
      const roster = await current.campaignService.listCampaignRosterEntries(campaignId);
      const characters = await Promise.all(
        roster
          .filter((entry) => entry.sourceType === "character")
          .map((entry) => current.characterService.getCharacterById(entry.sourceId)),
      );
      return characters.flatMap((character) =>
        character ? [{ id: character.id, name: character.name }] : [],
      );
    }

    app.post("/:sourceCharacterId/equipment/items/:itemId/transfer", async (request, reply) => {
      const user = await requireAdminUser(request, reply);
      if (!user) return;

      try {
        const sourceCharacterId = parsePathId(
          request.params,
          "sourceCharacterId",
          "Current holder",
        );
        const itemId = parsePathId(request.params, "itemId", "Item");
        const body = parseTransferItemBody(request.body);
        await requireCampaignAuthor(user.id, user.roles, body.campaignId);
        const characters = await campaignCharacters(body.campaignId);
        if (
          !characters.some((character) => character.id === sourceCharacterId) ||
          !characters.some((character) => character.id === body.targetCharacterId)
        ) {
          throw new Error("Choose Characters from this campaign roster.");
        }

        const current = services();
        await current.writeService.transferCampaignEquipmentItem({
          itemId,
          sourceCharacterId,
          ...body,
        });

        return {
          characters,
          state: await current.readService.getCampaignEquipmentState(body.campaignId),
        };
      } catch (error) {
        return handleRouteError(
          error instanceof StaleEquipmentTransferError
            ? new ConflictError(
                "This item has already moved. Refresh Campaign Items before trying again.",
              )
            : error instanceof StaleCharacterEquipmentAggregateError
              ? new ConflictError(
                  "Character equipment changed. Refresh Campaign Items before trying again.",
                )
              : error,
          reply,
        );
      }
    });
  };
}

export const equipmentTransferRoutes = createEquipmentTransferRoutes();

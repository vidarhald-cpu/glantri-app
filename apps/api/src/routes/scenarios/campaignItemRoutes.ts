import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
  CampaignService,
  CharacterService,
} from "@glantri/database";
import {
  DescriptiveItemTraitCategorySchema,
  EquipmentItemFactsV1Schema,
  EquipmentTemplateOverrideFactSchema,
  ItemCharacteristicFactSchema,
  ItemFactVisibilitySchema,
  type EquipmentItemFactsV1,
} from "@glantri/domain/equipment";

import { handleRouteError, NotFoundError } from "../../lib/errors";
import { requireAdminUser } from "../../lib/sessionAuth";
import { parseId } from "./parsing";

type Body = Record<string, unknown>;

function bodyObject(value: unknown): Body {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Item details are required.");
  }
  return value as Body;
}

function optionalText(body: Body, key: string): string | null {
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${key} must be text.`);
  return value.trim() || null;
}

function requiredText(body: Body, key: string): string {
  const value = optionalText(body, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalFactId(body: Body): string {
  return optionalText(body, "id") ?? randomUUID();
}

function integerValue(body: Body, key: string): number {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${key} must be a whole number.`);
  }
  return value;
}

function visibility(body: Body) {
  return ItemFactVisibilitySchema.parse(body.visibility);
}

function active(body: Body): boolean | undefined {
  return typeof body.active === "boolean" ? body.active : undefined;
}

export function parseCampaignItemFacts(value: unknown): EquipmentItemFactsV1 {
  const body = bodyObject(value);
  const initiative = body.initiativeOverride == null ? null : bodyObject(body.initiativeOverride);
  const finalOb = body.finalAttackObDelta == null ? null : bodyObject(body.finalAttackObDelta);
  const descriptive = body.descriptiveTraits ?? [];
  const characteristics = body.characteristics ?? [];
  const unsupported = body.unsupportedCapabilities ?? [];
  const templateOverrides = body.templateOverrides ?? [];

  if (
    !Array.isArray(descriptive) ||
    !Array.isArray(characteristics) ||
    !Array.isArray(templateOverrides) ||
    !Array.isArray(unsupported)
  ) {
    throw new Error("Item traits and capabilities must be lists.");
  }

  const nonInitiativeTemplateOverrides = templateOverrides
    .map((entry) => EquipmentTemplateOverrideFactSchema.parse(entry))
    .filter((entry) => entry.kind !== "weapon_initiative_override");

  return EquipmentItemFactsV1Schema.parse({
    activeMechanics: finalOb
      ? [
          {
            calculationStage: "final_attack_ob",
            active: active(finalOb),
            id: optionalFactId(finalOb),
            kind: "final_attack_ob_delta",
            provenance: finalOb.provenance,
            scope: "all_attack_modes",
            unit: "ob_points",
            value: integerValue(finalOb, "value"),
            visibility: visibility(finalOb),
          },
        ]
      : [],
    descriptiveTraits: descriptive.map((entry) => {
      const fact = bodyObject(entry);
      return {
        category: DescriptiveItemTraitCategorySchema.parse(fact.category),
        id: optionalFactId(fact),
        text: requiredText(fact, "text"),
        visibility: visibility(fact),
      };
    }),
    characteristics: characteristics.map((entry) => ItemCharacteristicFactSchema.parse(entry)),
    templateOverrides: [
      ...(initiative
        ? [
            {
              id: optionalFactId(initiative),
              active: active(initiative),
              kind: "weapon_initiative_override",
              provenance: initiative.provenance,
              scope: "all_attack_modes",
              unit: "initiative_points",
              value: integerValue(initiative, "value"),
              visibility: visibility(initiative),
            },
          ]
        : []),
      ...nonInitiativeTemplateOverrides,
    ],
    unsupportedCapabilities: unsupported.map((entry) => {
      const fact = bodyObject(entry);
      return {
        id: optionalFactId(fact),
        name: requiredText(fact, "name"),
        rulesText: requiredText(fact, "rulesText"),
        usageText: optionalText(fact, "usageText"),
        visibility: visibility(fact),
      };
    }),
    version: 1,
  });
}

export interface CampaignItemRouteServices {
  campaignService: CampaignService;
  characterService: CharacterService;
  readService: CharacterEquipmentReadModelService;
  writeService: CharacterEquipmentWriteService;
}

function defaultServices(): CampaignItemRouteServices {
  return {
    campaignService: new CampaignService(),
    characterService: new CharacterService(),
    readService: new CharacterEquipmentReadModelService(),
    writeService: new CharacterEquipmentWriteService(),
  };
}

export function createCampaignItemRoutes(
  configuredServices?: CampaignItemRouteServices,
): FastifyPluginAsync {
  return async (app) => {
    let resolvedServices = configuredServices;
    const services = () => (resolvedServices ??= defaultServices());

    async function requireCampaignAuthor(userId: string, roles: string[], campaignId: string) {
      const campaign = await services().campaignService.getCampaignById(campaignId);
      if (!campaign || (campaign.gmUserId !== userId && !roles.includes("admin"))) {
        throw new NotFoundError("Campaign not found.");
      }
      return campaign;
    }

    async function campaignCharacters(campaignId: string) {
      const current = services();
      const roster = await current.campaignService.listCampaignRosterEntries(campaignId);
      const characterEntries = roster.filter((entry) => entry.sourceType === "character");
      const characters = await Promise.all(
        characterEntries.map((entry) => current.characterService.getCharacterById(entry.sourceId)),
      );
      return characters.flatMap((character) =>
        character ? [{ id: character.id, name: character.name }] : [],
      );
    }

    app.get("/campaigns/:campaignId/items", async (request, reply) => {
      const user = await requireAdminUser(request, reply);
      if (!user) return;

      try {
        const campaignId = parseId(request.params, "campaignId", "Campaign id");
        await requireCampaignAuthor(user.id, user.roles, campaignId);
        const current = services();
        const [state, characters] = await Promise.all([
          current.readService.getCampaignEquipmentState(campaignId),
          campaignCharacters(campaignId),
        ]);
        return { characters, state };
      } catch (error) {
        return handleRouteError(error, reply);
      }
    });

    app.post("/campaigns/:campaignId/items", async (request, reply) => {
      const user = await requireAdminUser(request, reply);
      if (!user) return;

      try {
        const campaignId = parseId(request.params, "campaignId", "Campaign id");
        await requireCampaignAuthor(user.id, user.roles, campaignId);
        const current = services();
        const body = bodyObject(request.body);
        const holderCharacterId = optionalText(body, "holderCharacterId");
        const characters = await campaignCharacters(campaignId);
        if (
          holderCharacterId &&
          !characters.some((character) => character.id === holderCharacterId)
        ) {
          throw new Error("Choose a Character from this campaign.");
        }

        await current.writeService.createCampaignEquipmentItem({
          campaignId,
          displayName: optionalText(body, "displayName"),
          holderCharacterId,
          itemFacts: parseCampaignItemFacts(body.facts ?? {}),
          notes: optionalText(body, "description"),
          templateId: requiredText(body, "templateId"),
        });

        return {
          characters,
          state: await current.readService.getCampaignEquipmentState(campaignId),
        };
      } catch (error) {
        return handleRouteError(error, reply);
      }
    });

    app.patch("/campaigns/:campaignId/items/:itemId", async (request, reply) => {
      const user = await requireAdminUser(request, reply);
      if (!user) return;

      try {
        const campaignId = parseId(request.params, "campaignId", "Campaign id");
        const itemId = parseId(request.params, "itemId", "Item id");
        await requireCampaignAuthor(user.id, user.roles, campaignId);
        const current = services();
        const body = bodyObject(request.body);

        await current.writeService.updateCampaignEquipmentItemAuthoring({
          campaignId,
          displayName: optionalText(body, "displayName"),
          itemFacts: parseCampaignItemFacts(body.facts ?? {}),
          itemId,
          notes: optionalText(body, "description"),
        });

        return {
          characters: await campaignCharacters(campaignId),
          state: await current.readService.getCampaignEquipmentState(campaignId),
        };
      } catch (error) {
        return handleRouteError(error, reply);
      }
    });
  };
}

export const campaignItemRoutes = createCampaignItemRoutes();

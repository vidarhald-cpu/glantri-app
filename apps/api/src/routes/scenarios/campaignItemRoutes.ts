import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

import {
  CharacterEquipmentReadModelService,
  CharacterEquipmentWriteService,
  CampaignService,
  CharacterService,
  StaleCharacterEquipmentAggregateError,
  StaleEquipmentTransferError,
} from "@glantri/database";
import {
  DescriptiveItemTraitCategorySchema,
  EquipmentItemFactsV1Schema,
  EquipmentTemplateOverrideFactSchema,
  ItemFactVisibilitySchema,
  ItemMechanicalOverridesSchema,
  type EquipmentItemFactsV1,
} from "@glantri/domain/equipment";

import { ConflictError, handleRouteError, NotFoundError } from "../../lib/errors";
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

function physicalBaseEncumbrance(body: Body): number | null | undefined {
  const value = body.physicalBaseEncumbrance;
  if (value == null) return value as null | undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("Physical base ENC must be a nonnegative number.");
  return value;
}

function expectedRevision(body: Body): number {
  const value = body.expectedRevision;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("A valid equipment revision is required. Refresh before trying again.");
  }
  return value;
}

function visibility(body: Body) {
  return ItemFactVisibilitySchema.parse(body.visibility);
}

export function parseCampaignItemFacts(value: unknown): EquipmentItemFactsV1 {
  const body = bodyObject(value);
  const initiative = body.initiativeOverride == null ? null : bodyObject(body.initiativeOverride);
  const finalOb = body.finalAttackObDelta == null ? null : bodyObject(body.finalAttackObDelta);
  const descriptive = body.descriptiveTraits ?? [];
  const unsupported = body.unsupportedCapabilities ?? [];
  const templateOverrides = body.templateOverrides ?? [];

  if (
    !Array.isArray(descriptive) ||
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
            id: optionalFactId(finalOb),
            kind: "final_attack_ob_delta",
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
    templateOverrides: [
      ...(initiative
        ? [
            {
              id: optionalFactId(initiative),
              kind: "weapon_initiative_override",
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

    async function requireCampaignAuthor(userId: string, campaignId: string) {
      const campaign = await services().campaignService.getCampaignById(campaignId);
      if (!campaign || campaign.gmUserId !== userId) {
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
        await requireCampaignAuthor(user.id, campaignId);
        const current = services();
        // GM notes are fetched separately and only here. They are never part of
        // the equipment read model, which players reach through the character
        // equipment and encounter routes. This route is GM-authorized above.
        const [state, characters, gmNotesById] = await Promise.all([
          current.readService.getCampaignEquipmentState(campaignId),
          campaignCharacters(campaignId),
          current.readService.getCampaignEquipmentGmNotes(campaignId),
        ]);
        return { characters, gmNotesById, state };
      } catch (error) {
        return handleRouteError(error, reply);
      }
    });

    app.post("/campaigns/:campaignId/items", async (request, reply) => {
      const user = await requireAdminUser(request, reply);
      if (!user) return;

      try {
        const campaignId = parseId(request.params, "campaignId", "Campaign id");
        await requireCampaignAuthor(user.id, campaignId);
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
          evidence: { actorAuthority: "campaign_gm", actorUserId: user.id },
          holderCharacterId,
          itemFacts: parseCampaignItemFacts(body.facts ?? {}),
          notes: optionalText(body, "description"),
          quantity: body.quantity === undefined ? 1 : integerValue(body, "quantity"),
          templateId: body.templateId === null ? null : requiredText(body, "templateId"),
          mechanicalOverrides: ItemMechanicalOverridesSchema.parse(body.mechanicalOverrides ?? []),
          physicalBaseEncumbrance: physicalBaseEncumbrance(body) ?? null,
        });

        return {
          characters,
          state: await current.readService.getCampaignEquipmentState(campaignId),
        };
      } catch (error) {
        return handleRouteError(error, reply);
      }
    });

    app.post("/campaigns/:campaignId/items/:itemId/assign", async (request, reply) => {
      const user = await requireAdminUser(request, reply);
      if (!user) return;
      try {
        const campaignId = parseId(request.params, "campaignId", "Campaign id");
        const itemId = parseId(request.params, "itemId", "Item id");
        await requireCampaignAuthor(user.id, campaignId);
        const body = bodyObject(request.body);
        const targetCharacterId = requiredText(body, "targetCharacterId");
        const characters = await campaignCharacters(campaignId);
        if (!characters.some((character) => character.id === targetCharacterId)) {
          throw new Error("Choose a Character from this campaign.");
        }
        const current = services();
        await current.writeService.assignCampaignEquipmentItem({
          campaignId,
          evidence: { actorAuthority: "campaign_gm", actorUserId: user.id },
          itemId,
          expectedItemRevision: requiredText(body, "expectedItemRevision"),
          targetCharacterId,
          targetExpectedRevision: expectedRevision(body),
        });
        return {
          characters,
          state: await current.readService.getCampaignEquipmentState(campaignId),
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

    app.post("/campaigns/:campaignId/items/:itemId/unassign", async (request, reply) => {
      const user = await requireAdminUser(request, reply);
      if (!user) return;
      try {
        const campaignId = parseId(request.params, "campaignId", "Campaign id");
        const itemId = parseId(request.params, "itemId", "Item id");
        await requireCampaignAuthor(user.id, campaignId);
        const body = bodyObject(request.body);
        const sourceCharacterId = requiredText(body, "sourceCharacterId");
        const characters = await campaignCharacters(campaignId);
        if (!characters.some((character) => character.id === sourceCharacterId)) {
          throw new Error("Choose a Character from this campaign.");
        }
        const current = services();
        await current.writeService.unassignCampaignEquipmentItem({
          campaignId,
          evidence: { actorAuthority: "campaign_gm", actorUserId: user.id },
          itemId,
          expectedItemRevision: requiredText(body, "expectedItemRevision"),
          sourceCharacterId,
          sourceExpectedRevision: expectedRevision(body),
        });
        return {
          characters,
          state: await current.readService.getCampaignEquipmentState(campaignId),
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

    app.patch("/campaigns/:campaignId/items/:itemId", async (request, reply) => {
      const user = await requireAdminUser(request, reply);
      if (!user) return;

      try {
        const campaignId = parseId(request.params, "campaignId", "Campaign id");
        const itemId = parseId(request.params, "itemId", "Item id");
        await requireCampaignAuthor(user.id, campaignId);
        const current = services();
        const body = bodyObject(request.body);

        await current.writeService.updateCampaignEquipmentItemAuthoring({
          campaignId,
          displayName: optionalText(body, "displayName"),
          itemFacts: parseCampaignItemFacts(body.facts ?? {}),
          itemId,
          expectedItemRevision: requiredText(body, "expectedItemRevision"),
          notes: optionalText(body, "description"),
          mechanicalOverrides:
            body.mechanicalOverrides === undefined
              ? undefined
              : ItemMechanicalOverridesSchema.parse(body.mechanicalOverrides),
          physicalBaseEncumbrance: physicalBaseEncumbrance(body),
          quantity: body.quantity === undefined ? undefined : integerValue(body, "quantity"),
        });

        return {
          characters: await campaignCharacters(campaignId),
          state: await current.readService.getCampaignEquipmentState(campaignId),
        };
      } catch (error) {
        return handleRouteError(
          error instanceof StaleEquipmentTransferError
            ? new ConflictError(
                "This item changed. Your draft has not been saved. Reload and review it before trying again.",
              )
            : error,
          reply,
        );
      }
    });
  };
}

export const campaignItemRoutes = createCampaignItemRoutes();

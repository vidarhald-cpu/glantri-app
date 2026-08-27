import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../client";

type BlackboardReadClient = PrismaClient | Prisma.TransactionClient;

export interface ResolvedBlackboardViewerCharacter {
  id: string;
  label: string;
}

/**
 * Resolves only explicit, currently controlled, same-Campaign roster Characters.
 * Explicit live-Scenario delegation overrides ownership; conflicting delegation
 * fails closed. Campaign access is checked separately by BlackboardService.
 */
export async function resolveBlackboardViewerCharacter(
  input: {
    campaignId: string;
    userId: string;
    viewerCharacterId: string;
  },
  client: BlackboardReadClient = prisma,
): Promise<ResolvedBlackboardViewerCharacter | null> {
  const rows = await client.$queryRaw<
    Array<{
      controllerIds: Array<string | null>;
      id: string;
      name: string;
      ownerId: string | null;
    }>
  >(Prisma.sql`
    SELECT
      c."id",
      c."name",
      c."ownerId",
      ARRAY(
        SELECT DISTINCT participant."controlledByUserId"
        FROM "ScenarioParticipant" participant
        JOIN "Scenario" scenario
          ON scenario."id" = participant."scenarioId"
        WHERE participant."characterId" = c."id"
          AND participant."sourceType" = 'character'
          AND participant."role" = 'player_character'
          AND participant."isActive" = TRUE
          AND participant."controlledByUserId" IS NOT NULL
          AND scenario."campaignId" = ${input.campaignId}
          AND scenario."status" = 'live'
        ORDER BY participant."controlledByUserId"
      ) AS "controllerIds"
    FROM "Character" c
    JOIN "CampaignRosterEntry" roster
      ON roster."sourceType" = 'character'
     AND roster."sourceId" = c."id"
     AND roster."campaignId" = ${input.campaignId}
    WHERE c."id" = ${input.viewerCharacterId}
  `);

  const character = rows[0];
  if (!character) return null;
  const explicitControllers = [...new Set(character.controllerIds.filter(Boolean))] as string[];
  if (explicitControllers.length > 1) return null;
  const controllerId = explicitControllers[0] ?? character.ownerId;
  if (!controllerId || controllerId !== input.userId) return null;
  return { id: character.id, label: character.name };
}

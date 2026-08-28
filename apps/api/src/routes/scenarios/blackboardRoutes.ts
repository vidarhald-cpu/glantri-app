import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  BlackboardConflictError,
  BlackboardDetailUnavailableError,
  BlackboardReferenceUnavailableError,
  BlackboardService,
  BlackboardUnavailableError,
} from "@glantri/database";

import { getAuthenticatedUser } from "../../lib/sessionAuth";

const BOARD_ABSENCE = { error: "Blackboard unavailable." } as const;
const DETAIL_ABSENCE = { error: "Blackboard detail unavailable." } as const;
const REFERENCE_ABSENCE = { error: "Blackboard reference unavailable." } as const;

function parseViewerQuery(value: unknown): { viewerCharacterId?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const query = value as Record<string, unknown>;
  if (Object.keys(query).some((key) => key !== "viewerCharacterId")) throw new SyntaxError();
  if (query.viewerCharacterId === undefined) return {};
  if (typeof query.viewerCharacterId !== "string" || !query.viewerCharacterId) {
    throw new SyntaxError();
  }
  return { viewerCharacterId: query.viewerCharacterId };
}

function routeId(request: FastifyRequest, key: string): string {
  const params = request.params as Record<string, unknown>;
  return typeof params[key] === "string" && params[key] ? (params[key] as string) : "";
}

async function requirePrivateUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    await reply.code(404).send(BOARD_ABSENCE);
    return null;
  }
  return user;
}

function requireMutationDefense(request: FastifyRequest, reply: FastifyReply): boolean {
  const expectedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  if (
    request.headers.origin !== expectedOrigin ||
    request.headers["x-glantri-blackboard-mutation"] !== "1"
  ) {
    void reply.code(404).send(REFERENCE_ABSENCE);
    return false;
  }
  return true;
}

function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof BlackboardUnavailableError) {
    return reply.code(404).send(BOARD_ABSENCE);
  }
  if (error instanceof BlackboardDetailUnavailableError) {
    return reply.code(404).send(DETAIL_ABSENCE);
  }
  if (error instanceof BlackboardReferenceUnavailableError) {
    return reply.code(404).send(REFERENCE_ABSENCE);
  }
  if (error instanceof BlackboardConflictError) {
    return reply
      .code(409)
      .send({ error: error.message, ...(error.retryable ? { retryable: true } : {}) });
  }
  if ((error as { name?: string }).name === "ZodError" || error instanceof SyntaxError) {
    return reply.code(400).send({ error: "Invalid Blackboard request." });
  }
  request.log.error({ category: "blackboard_operation_failed" }, "Blackboard operation failed");
  return reply.code(500).send({ error: "Unable to complete the Blackboard action." });
}

function body(request: FastifyRequest): unknown {
  return request.body && typeof request.body === "object" ? request.body : {};
}

export const blackboardRoutes: FastifyPluginAsync = async (app) => {
  let service: BlackboardService | undefined;
  const getService = () => (service ??= new BlackboardService());

  app.get("/campaigns/:campaignId/blackboard", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return await getService().getBoard(routeId(request, "campaignId"), user.id);
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/blackboard/capabilities", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return await getService().getViewerCapabilities(routeId(request, "campaignId"), user.id);
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/blackboard/entries/:entryId", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      const query = parseViewerQuery(request.query ?? {});
      return await getService().getEntry({
        campaignId: routeId(request, "campaignId"),
        entryId: routeId(request, "entryId"),
        userId: user.id,
        viewerCharacterId: query.viewerCharacterId,
      });
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/blackboard/entries/:entryId/history", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return await getService().getHistory(
        routeId(request, "campaignId"),
        routeId(request, "entryId"),
        user.id,
      );
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/blackboard/entries/:entryId/audit", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return await getService().getAudit(
        routeId(request, "campaignId"),
        routeId(request, "entryId"),
        user.id,
      );
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.post("/campaigns/:campaignId/blackboard/entries", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    try {
      const result = await getService().createEntry(
        routeId(request, "campaignId"),
        user.id,
        body(request),
      );
      return reply.code(201).send(result);
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.post(
    "/campaigns/:campaignId/blackboard/entries/:entryId/revisions",
    async (request, reply) => {
      const user = await requirePrivateUser(request, reply);
      if (!user || !requireMutationDefense(request, reply)) return;
      try {
        return await getService().reviseEntry(
          routeId(request, "campaignId"),
          routeId(request, "entryId"),
          user.id,
          body(request),
        );
      } catch (error) {
        return sendError(request, reply, error);
      }
    },
  );

  for (const action of ["retract", "archive"] as const) {
    app.post(
      `/campaigns/:campaignId/blackboard/entries/:entryId/${action}`,
      async (request, reply) => {
        const user = await requirePrivateUser(request, reply);
        if (!user || !requireMutationDefense(request, reply)) return;
        try {
          return action === "retract"
            ? await getService().retractEntry(
                routeId(request, "campaignId"),
                routeId(request, "entryId"),
                user.id,
                body(request),
              )
            : await getService().archiveEntry(
                routeId(request, "campaignId"),
                routeId(request, "entryId"),
                user.id,
                body(request),
              );
        } catch (error) {
          return sendError(request, reply, error);
        }
      },
    );
  }

  app.post(
    "/campaigns/:campaignId/blackboard/entries/:entryId/detail-grants/:characterId/:unitKey",
    async (request, reply) => {
      const user = await requirePrivateUser(request, reply);
      if (!user || !requireMutationDefense(request, reply)) return;
      try {
        return await getService().changeGrant({
          campaignId: routeId(request, "campaignId"),
          characterId: routeId(request, "characterId"),
          entryId: routeId(request, "entryId"),
          rawInput: body(request),
          unitKey: routeId(request, "unitKey"),
          userId: user.id,
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    },
  );

  app.post("/campaigns/:campaignId/blackboard/placements", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    try {
      return await getService().createPlacement(
        routeId(request, "campaignId"),
        user.id,
        body(request),
      );
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.patch("/campaigns/:campaignId/blackboard/placements/:entryId", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    try {
      return await getService().updatePlacement(
        routeId(request, "campaignId"),
        routeId(request, "entryId"),
        user.id,
        body(request),
      );
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.delete("/campaigns/:campaignId/blackboard/placements/:entryId", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    try {
      return await getService().deletePlacement(
        routeId(request, "campaignId"),
        routeId(request, "entryId"),
        user.id,
        body(request),
      );
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.post("/campaigns/:campaignId/blackboard/placements/group", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    try {
      return await getService().groupPlacements(
        routeId(request, "campaignId"),
        user.id,
        body(request),
      );
    } catch (error) {
      return sendError(request, reply, error);
    }
  });
};

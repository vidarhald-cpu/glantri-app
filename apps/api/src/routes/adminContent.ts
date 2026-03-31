import type { FastifyPluginAsync } from "fastify";

import {
  CanonicalContentRevisionConflictError,
  CanonicalContentValidationError
} from "../lib/adminContentService";
import type {
  AdminContentConflictResponse,
  AdminContentGetResponse,
  AdminContentPutRequest,
  AdminContentPutResponse
} from "@glantri/shared";
import type { CanonicalContent } from "@glantri/content";

import { CanonicalContentService } from "../lib/adminContentService";
import { requireAdminUser } from "../lib/sessionAuth";

const canonicalContentService = new CanonicalContentService();

function parseSaveAdminContentInput(body: unknown): AdminContentPutRequest {
  if (typeof body !== "object" || body === null || !("expectedRevision" in body)) {
    throw new Error("Invalid admin content payload.");
  }

  const candidate = body as {
    content?: unknown;
    expectedRevision?: unknown;
  };

  if (
    typeof candidate.expectedRevision !== "number" ||
    !Number.isInteger(candidate.expectedRevision) ||
    candidate.expectedRevision < 0
  ) {
    throw new Error("Invalid admin content revision.");
  }

  return {
    content: candidate.content,
    expectedRevision: candidate.expectedRevision
  };
}

export const adminContentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/content", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    const snapshot = await canonicalContentService.getCanonicalContent();

    return {
      ...snapshot
    } satisfies AdminContentGetResponse<CanonicalContent>;
  });

  app.put("/content", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    let input: AdminContentPutRequest;

    try {
      input = parseSaveAdminContentInput(request.body);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid admin content payload."
      });
    }

    try {
      const snapshot = await canonicalContentService.saveCanonicalContent(input);

      return {
        ...snapshot
      } satisfies AdminContentPutResponse<CanonicalContent>;
    } catch (error: unknown) {
      if (error instanceof CanonicalContentRevisionConflictError) {
        return reply.code(409).send({
          current: error.current,
          error: "Canonical content has changed on the server. Reload before saving again."
        } satisfies AdminContentConflictResponse<CanonicalContent>);
      }

      if (error instanceof CanonicalContentValidationError) {
        return reply.code(400).send({
          error: error.message
        });
      }

      throw error;
    }
  });
};

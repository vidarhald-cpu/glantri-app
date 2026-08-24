import { Readable } from "node:stream";

import multipart from "@fastify/multipart";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  ArtifactConflictError,
  ArtifactLifecycleError,
  ArtifactNotFoundError,
  ArtifactService,
  ArtifactStorageUnavailableError,
  ArtifactUploadValidationError,
} from "@glantri/database";
import {
  artifactAudienceUpdateSchema,
  artifactMetadataUpdateSchema,
  artifactUploadMetadataSchema,
  scenarioArtifactReferenceMutationSchema,
} from "@glantri/domain";

import { createArtifactStorageRuntime } from "../artifacts/artifactStorageConfig";
import { getAuthenticatedUser } from "../lib/sessionAuth";

const ABSENCE = { error: "Artifact not found." } as const;
const STORAGE_UNAVAILABLE = { error: "Artifact storage is temporarily unavailable." } as const;
const ARTIFACT_MULTIPART_LIMIT_BYTES = 25 * 1024 * 1024 + 1;

function routeId(request: FastifyRequest, key: string): string {
  const params = request.params as Record<string, unknown>;
  return typeof params[key] === "string" && params[key] ? (params[key] as string) : "";
}

async function requirePrivateUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    await reply.code(404).send(ABSENCE);
    return null;
  }
  return user;
}

function requireMutationDefense(request: FastifyRequest, reply: FastifyReply): boolean {
  const expectedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  if (
    request.headers.origin !== expectedOrigin ||
    request.headers["x-glantri-artifact-mutation"] !== "1"
  ) {
    void reply.code(403).send({ error: "Artifact action not allowed." });
    return false;
  }
  return true;
}

function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof ArtifactNotFoundError) return reply.code(404).send(ABSENCE);
  if (error instanceof ArtifactConflictError) return reply.code(409).send({ error: error.message });
  if (error instanceof ArtifactLifecycleError || error instanceof ArtifactUploadValidationError) {
    return reply.code(400).send({ error: error.message });
  }
  if (
    (error as { name?: string }).name === "ZodError" ||
    error instanceof SyntaxError ||
    (error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE"
  ) {
    return reply.code(400).send({ error: "Invalid Artifact request." });
  }
  if (error instanceof ArtifactStorageUnavailableError) {
    return reply.code(503).send(STORAGE_UNAVAILABLE);
  }
  request.log.error({ category: "artifact_operation_failed" }, "Artifact operation failed");
  return reply.code(500).send({ error: "Unable to complete the Artifact action." });
}

function parseJsonBody(request: FastifyRequest): unknown {
  return request.body && typeof request.body === "object" ? request.body : {};
}

export const artifactRoutes: FastifyPluginAsync = async (app) => {
  const runtime = createArtifactStorageRuntime();
  let service: ArtifactService | undefined;
  const getArtifactService = () => (service ??= new ArtifactService(runtime.store));
  await app.register(multipart, {
    // Let the validator observe the first byte over the public limit instead of
    // allowing multipart truncation to look like a valid exactly-25-MiB file.
    limits: { files: 1, fileSize: ARTIFACT_MULTIPART_LIMIT_BYTES, fields: 1, parts: 2 },
  });

  app.get("/campaigns/:campaignId/artifacts/blackboard-candidates", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return {
        artifacts: await getArtifactService().listBlackboardCandidates(
          routeId(request, "campaignId"),
          user.id,
        ),
      };
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/artifacts", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    const campaignId = routeId(request, "campaignId");
    try {
      try {
        return {
          artifacts: await getArtifactService().listForGm(campaignId, user.id),
          mode: "gm",
          references: await getArtifactService().listReferencesForGm(campaignId, user.id),
        };
      } catch (error) {
        if (!(error instanceof ArtifactNotFoundError)) throw error;
        return {
          artifacts: await getArtifactService().listVisible(campaignId, user.id),
          mode: "viewer",
        };
      }
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/artifacts/:artifactId", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    const campaignId = routeId(request, "campaignId");
    const artifactId = routeId(request, "artifactId");
    try {
      try {
        return {
          artifact: await getArtifactService().getForGm(campaignId, artifactId, user.id),
          mode: "gm",
        };
      } catch (error) {
        if (!(error instanceof ArtifactNotFoundError)) throw error;
        return {
          artifact: await getArtifactService().getVisible(campaignId, artifactId, user.id),
          mode: "viewer",
        };
      }
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/artifacts/:artifactId/content", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    if (!runtime.enabled) return reply.code(503).send(STORAGE_UNAVAILABLE);
    try {
      const result = await getArtifactService().readContent({
        artifactId: routeId(request, "artifactId"),
        campaignId: routeId(request, "campaignId"),
        userId: user.id,
      });
      reply.header("cache-control", "private, no-store");
      reply.header("x-content-type-options", "nosniff");
      reply.header("content-security-policy", "sandbox; default-src 'none'");
      reply.header("content-type", result.mediaType);
      reply.header("content-length", String(result.body.byteSize));
      reply.header(
        "content-disposition",
        result.mediaType === "application/pdf"
          ? `attachment; filename="artifact-${routeId(request, "artifactId")}.pdf"`
          : "inline",
      );
      return reply.send(Readable.from(result.body.content));
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.post("/campaigns/:campaignId/artifacts", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    if (!runtime.enabled) return reply.code(503).send(STORAGE_UNAVAILABLE);

    try {
      const campaignId = routeId(request, "campaignId");
      await getArtifactService().assertOwningGm(campaignId, user.id);
      let metadata: ReturnType<typeof artifactUploadMetadataSchema.parse> | undefined;
      let artifact;
      for await (const part of request.parts()) {
        if (part.type === "field") {
          if (part.fieldname !== "metadata" || typeof part.value !== "string" || metadata) {
            throw new ArtifactUploadValidationError("Invalid Artifact upload fields.");
          }
          metadata = artifactUploadMetadataSchema.parse(JSON.parse(part.value));
          continue;
        }
        if (part.fieldname !== "file" || !metadata || artifact) {
          part.file.resume();
          throw new ArtifactUploadValidationError("Send Artifact metadata before one file.");
        }
        artifact = await getArtifactService().upload({
          campaignId,
          content: part.file,
          declaredMediaType: part.mimetype,
          metadata,
          originalFilename: part.filename,
          userId: user.id,
        });
        if (part.file.truncated) {
          throw new ArtifactUploadValidationError("The uploaded file exceeds the 25 MiB limit.");
        }
      }
      if (!artifact) throw new ArtifactUploadValidationError("Choose a file to upload.");
      return reply.code(201).send({ artifact });
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.patch("/campaigns/:campaignId/artifacts/:artifactId", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    try {
      return {
        artifact: await getArtifactService().updateMetadata({
          artifactId: routeId(request, "artifactId"),
          campaignId: routeId(request, "campaignId"),
          update: artifactMetadataUpdateSchema.parse(parseJsonBody(request)),
          userId: user.id,
        }),
      };
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.put("/campaigns/:campaignId/artifacts/:artifactId/audience", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    try {
      const update = artifactAudienceUpdateSchema.parse(parseJsonBody(request));
      return {
        artifact: await getArtifactService().setAudience({
          artifactId: routeId(request, "artifactId"),
          audience: update.audience,
          campaignId: routeId(request, "campaignId"),
          expectedVersion: update.expectedMetadataVersion,
          userId: user.id,
        }),
      };
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  for (const action of ["attach", "publish", "withdraw"] as const) {
    app.post(
      `/campaigns/:campaignId/scenarios/:scenarioId/artifacts/:artifactId/${action}`,
      async (request, reply) => {
        const user = await requirePrivateUser(request, reply);
        if (!user || !requireMutationDefense(request, reply)) return;
        try {
          const update = scenarioArtifactReferenceMutationSchema.parse(parseJsonBody(request));
          return await getArtifactService().mutateScenarioReference({
            action,
            altText: update.altText,
            artifactId: routeId(request, "artifactId"),
            campaignId: routeId(request, "campaignId"),
            caption: update.caption,
            expectedArtifactVersion: update.expectedArtifactVersion,
            expectedReferenceVersion: update.expectedReferenceVersion,
            scenarioId: routeId(request, "scenarioId"),
            sortOrder: update.sortOrder,
            title: update.title,
            userId: user.id,
          });
        } catch (error) {
          return sendError(request, reply, error);
        }
      },
    );
  }

  app.put("/campaigns/:campaignId/artifacts/:artifactId/lifecycle", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    try {
      const body = parseJsonBody(request) as Record<string, unknown>;
      if (
        (body.lifecycle !== "active" && body.lifecycle !== "archived") ||
        !Number.isInteger(body.expectedMetadataVersion)
      ) {
        throw new ArtifactLifecycleError("Invalid Artifact lifecycle action.");
      }
      return {
        artifact: await getArtifactService().setLifecycle({
          artifactId: routeId(request, "artifactId"),
          campaignId: routeId(request, "campaignId"),
          expectedVersion: body.expectedMetadataVersion as number,
          lifecycle: body.lifecycle,
          userId: user.id,
        }),
      };
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.delete("/campaigns/:campaignId/artifacts/:artifactId", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    try {
      const body = parseJsonBody(request) as Record<string, unknown>;
      if (!Number.isInteger(body.expectedMetadataVersion)) {
        throw new ArtifactLifecycleError("Invalid Artifact delete action.");
      }
      return {
        artifact: await getArtifactService().delete({
          artifactId: routeId(request, "artifactId"),
          campaignId: routeId(request, "campaignId"),
          expectedVersion: body.expectedMetadataVersion as number,
          userId: user.id,
        }),
      };
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.post("/campaigns/:campaignId/artifacts/:artifactId/cleanup-retry", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    if (!runtime.enabled) return reply.code(503).send(STORAGE_UNAVAILABLE);
    try {
      return {
        artifact: await getArtifactService().retryCleanup({
          artifactId: routeId(request, "artifactId"),
          campaignId: routeId(request, "campaignId"),
          userId: user.id,
        }),
      };
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/artifacts/:artifactId/audit", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return {
        events: await getArtifactService().listAudit(
          routeId(request, "campaignId"),
          routeId(request, "artifactId"),
          user.id,
        ),
      };
    } catch (error) {
      return sendError(request, reply, error);
    }
  });
};

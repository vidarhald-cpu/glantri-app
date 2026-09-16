import { Readable } from "node:stream";
import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { ArtifactImportService, ArtifactUploadValidationError } from "@glantri/database";
import {
  ARTIFACT_PACKAGE_LIMITS,
  artifactImportSelectionSchema,
  artifactImportAcceptanceSchema,
} from "@glantri/domain";
import { createArtifactStorageRuntime } from "../artifacts/artifactStorageConfig";
import { requirePrivateUser, requireMutationDefense, routeId, sendError } from "./artifacts";

export const artifactImportRoutes: FastifyPluginAsync = async (app) => {
  const runtime = createArtifactStorageRuntime();
  const service = new ArtifactImportService(runtime.store);
  await app.register(multipart, {
    limits: {
      files: 100,
      fields: 1,
      parts: 101,
      fileSize: ARTIFACT_PACKAGE_LIMITS.resourceBytes + 1,
      fieldSize: ARTIFACT_PACKAGE_LIMITS.manifestBytes,
    },
  });
  const base = "/campaigns/:campaignId/artifact-imports";
  app.get(base, async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return { imports: await service.list(routeId(request, "campaignId"), user.id) };
    } catch (error) {
      return sendError(request, reply, error);
    }
  });
  app.post(base, async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user || !requireMutationDefense(request, reply)) return;
    const campaignId = routeId(request, "campaignId");
    let id: string | undefined;
    try {
      await service.assertOwner(campaignId, user.id);
      if (!runtime.enabled)
        return reply.code(503).send({ error: "Artifact storage is temporarily unavailable." });
      for await (const part of request.parts()) {
        if (part.type === "field") {
          if (
            id ||
            part.fieldname !== "manifest" ||
            typeof part.value !== "string" ||
            part.valueTruncated ||
            Buffer.byteLength(part.value) > ARTIFACT_PACKAGE_LIMITS.manifestBytes
          )
            throw new ArtifactUploadValidationError(
              "Send one bounded manifest before its resources.",
            );
          id = (await service.begin(campaignId, user.id, JSON.parse(part.value))).id;
        } else {
          if (!id) {
            part.file.resume();
            throw new ArtifactUploadValidationError("Send the manifest before resources.");
          }
          await service.uploadResource({
            campaignId,
            userId: user.id,
            id,
            resourceId: part.fieldname,
            content: part.file,
            mediaType: part.mimetype,
            filename: part.filename,
          });
          if (part.file.truncated)
            throw new ArtifactUploadValidationError("A resource exceeds 25 MiB.");
        }
      }
      if (!id) throw new ArtifactUploadValidationError("Choose an Artifact package.");
      return reply.code(201).send({ preview: await service.finish(campaignId, user.id, id) });
    } catch (error) {
      if (id) await service.abort(campaignId, user.id, id);
      return sendError(request, reply, error);
    }
  });
  app.get(`${base}/:importId`, async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return {
        preview: await service.get(
          routeId(request, "campaignId"),
          user.id,
          routeId(request, "importId"),
        ),
      };
    } catch (error) {
      return sendError(request, reply, error);
    }
  });
  for (const action of ["preview", "accept", "cleanup"] as const)
    app.post(`${base}/:importId/${action}`, async (request, reply) => {
      const user = await requirePrivateUser(request, reply);
      if (!user || !requireMutationDefense(request, reply)) return;
      const campaignId = routeId(request, "campaignId"),
        id = routeId(request, "importId");
      try {
        if (action === "cleanup") return service.cleanup(campaignId, user.id, id);
        if (action === "preview") {
          const input = artifactImportSelectionSchema.parse(request.body);
          return { preview: await service.preview(campaignId, user.id, id, input.selected) };
        }
        const input = artifactImportAcceptanceSchema.parse(request.body);
        return {
          preview: await service.accept(
            campaignId,
            user.id,
            id,
            input.previewToken,
            input.approvedUpdates,
          ),
        };
      } catch (error) {
        return sendError(request, reply, error);
      }
    });
  app.get(`${base}/:importId/resources/:resourceId`, async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      const result = await service.read(
        routeId(request, "campaignId"),
        user.id,
        routeId(request, "importId"),
        routeId(request, "resourceId"),
      );
      reply
        .header("cache-control", "private, no-store")
        .header("content-type", result.mediaType)
        .header("content-length", String(result.body.byteSize))
        .header("x-content-type-options", "nosniff")
        .header("content-security-policy", "sandbox; default-src 'none'")
        .header(
          "content-disposition",
          result.mediaType === "application/pdf" ? 'attachment; filename="preview.pdf"' : "inline",
        );
      return reply.send(Readable.from(result.body.content));
    } catch (error) {
      return sendError(request, reply, error);
    }
  });
};

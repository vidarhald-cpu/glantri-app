import type { FastifyPluginAsync } from "fastify";

import { CanonicalContentService } from "../lib/adminContentService";

const canonicalContentService = new CanonicalContentService();

export const contentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    const snapshot = await canonicalContentService.getCanonicalContent();

    return {
      content: snapshot.content,
      revision: snapshot.revision,
      source: snapshot.source,
      status: "ready",
      version: `r${snapshot.revision}`
    };
  });
};

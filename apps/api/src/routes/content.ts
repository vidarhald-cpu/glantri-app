import type { FastifyPluginAsync } from "fastify";

import { loadCanonicalContent } from "@glantri/content";

export const contentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({
    content: await loadCanonicalContent(),
    status: "ready",
    version: "v1"
  }));
};

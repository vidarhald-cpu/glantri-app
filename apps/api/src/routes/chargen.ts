import type { FastifyPluginAsync } from "fastify";

export const chargenRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({
    resource: "chargen",
    status: "scaffolded"
  }));
};

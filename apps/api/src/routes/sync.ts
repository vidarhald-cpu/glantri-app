import type { FastifyPluginAsync } from "fastify";

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({
    cursor: new Date(0).toISOString(),
    items: [],
    resource: "sync",
    status: "scaffolded"
  }));

  app.post("/", async () => ({
    acceptedIds: [],
    rejectedIds: []
  }));
};

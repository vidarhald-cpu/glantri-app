import Fastify from "fastify";

import { applyLocalCors } from "./lib/sessionAuth";
import { checkReadiness } from "./lib/readiness";
import { adminContentRoutes } from "./routes/adminContent";
import { authRoutes } from "./routes/auth";
import { characterEquipmentRoutes } from "./routes/characterEquipment";
import { charactersRoutes } from "./routes/characters";
import { chargenRoutes } from "./routes/chargen";
import { contentRoutes } from "./routes/content";
import { scenariosRoutes } from "./routes/scenarios";
import { syncRoutes } from "./routes/sync";

const isProduction = process.env.NODE_ENV === "production";

export function buildApiServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug")
    }
  });

  applyLocalCors(app);

  app.get("/health", async () => ({
    service: "@glantri/api",
    status: "ok"
  }));

  app.get("/ready", async (_request, reply) => {
    const readiness = await checkReadiness();

    if (readiness.status === "ready") {
      return {
        service: "@glantri/api",
        status: "ready"
      };
    }

    return reply.code(503).send({
      service: "@glantri/api",
      status: "not_ready",
      reason: readiness.reason
    });
  });

  app.register(authRoutes, { prefix: "/auth" });
  app.register(adminContentRoutes, { prefix: "/api/admin" });
  app.register(contentRoutes, { prefix: "/content" });
  app.register(chargenRoutes, { prefix: "/chargen" });
  app.register(charactersRoutes, { prefix: "/characters" });
  app.register(characterEquipmentRoutes, { prefix: "/characters" });
  app.register(scenariosRoutes);
  app.register(syncRoutes, { prefix: "/sync" });

  return app;
}

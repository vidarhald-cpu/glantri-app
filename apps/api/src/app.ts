import Fastify from "fastify";

import { applyLocalCors } from "./lib/sessionAuth";
import { authRoutes } from "./routes/auth";
import { charactersRoutes } from "./routes/characters";
import { chargenRoutes } from "./routes/chargen";
import { contentRoutes } from "./routes/content";
import { syncRoutes } from "./routes/sync";

export function buildApiServer() {
  const app = Fastify({
    logger: true
  });

  applyLocalCors(app);

  app.get("/health", async () => ({
    service: "@glantri/api",
    status: "ok"
  }));

  app.register(authRoutes, { prefix: "/auth" });
  app.register(contentRoutes, { prefix: "/content" });
  app.register(chargenRoutes, { prefix: "/chargen" });
  app.register(charactersRoutes, { prefix: "/characters" });
  app.register(syncRoutes, { prefix: "/sync" });

  return app;
}

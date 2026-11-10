import Fastify from "fastify";

import { isInternalServerError, sendInternalServerError } from "./lib/errors";
import { applyLocalCors } from "./lib/sessionAuth";
import {
  finishCombatPerformanceRequest,
  runCombatPerformanceRequest,
} from "./lib/combatPerformance";
import { registerCombatPerformanceCaptureRoute } from "./lib/combatPerformanceCapture";
import { checkReadiness } from "./lib/readiness";
import { registerResponseCompression } from "./lib/responseCompression";
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
      level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
    },
  });

  // Forgejo #1048 (A1): errors that escape a route (auth lookups before a route's `try`, routes
  // with no `try`) must not reach the client through Fastify's default handler, which echoes
  // `error.message`. Internal failures get the fixed body; every other error is delegated to
  // Fastify's own default handler unchanged, so validation 400s, 404s, 413s etc. keep their shape.
  // Re-sending the error lets Fastify run its stock handling (and logging) exactly once; calling
  // the default handler directly would log every such error a second time.
  app.setErrorHandler((error, _request, reply) => {
    if (isInternalServerError(error)) {
      return sendInternalServerError(error, reply);
    }
    return reply.send(error);
  });

  applyLocalCors(app);
  registerResponseCompression(app);
  app.addHook("onRequest", (request, _reply, done) => {
    runCombatPerformanceRequest(request, done);
  });
  app.addHook("onResponse", (request, reply, done) => {
    finishCombatPerformanceRequest(reply.statusCode);
    done();
  });

  app.get("/health", async () => ({
    service: "@glantri/api",
    status: "ok",
  }));

  app.get("/ready", async (_request, reply) => {
    const readiness = await checkReadiness();

    if (readiness.status === "ready") {
      return {
        service: "@glantri/api",
        status: "ready",
      };
    }

    return reply.code(503).send({
      service: "@glantri/api",
      status: "not_ready",
      reason: readiness.reason,
    });
  });

  registerCombatPerformanceCaptureRoute(app);
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

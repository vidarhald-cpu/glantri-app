import type { FastifyPluginAsync } from "fastify";

import {
  credentialLoginInputSchema,
  credentialRegisterInputSchema
} from "@glantri/auth";
import { AuthService } from "@glantri/database";

import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  getAuthenticatedUser,
  getSessionTokenFromRequest
} from "../lib/sessionAuth";

const authService = new AuthService();

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", async (request) => {
    const user = await getAuthenticatedUser(request, authService);

    return {
      user
    };
  });

  app.post("/register", async (request, reply) => {
    const input = credentialRegisterInputSchema.parse(request.body);
    const existingUser = await authService.findUserByEmail(input.email);

    if (existingUser) {
      return reply.code(409).send({
        error: "A user with that email already exists."
      });
    }

    const user = await authService.registerLocalUser(input);
    const { session, token } = await authService.createSessionForUser(user.id);

    reply.header("set-cookie", buildSessionCookie(token, session.expiresAt));

    return {
      user
    };
  });

  app.post("/login", async (request, reply) => {
    const input = credentialLoginInputSchema.parse(request.body);
    const user = await authService.loginWithCredentials(input);

    if (!user) {
      return reply.code(401).send({
        error: "Invalid email or password."
      });
    }

    const { session, token } = await authService.createSessionForUser(user.id);
    reply.header("set-cookie", buildSessionCookie(token, session.expiresAt));

    return {
      user
    };
  });

  app.post("/logout", async (request, reply) => {
    const token = getSessionTokenFromRequest(request);

    if (token) {
      await authService.logout(token);
    }

    reply.header("set-cookie", buildExpiredSessionCookie());

    return {
      ok: true
    };
  });
};

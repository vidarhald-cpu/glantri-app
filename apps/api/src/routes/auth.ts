import type { FastifyPluginAsync } from "fastify";

import {
  authRoleSchema,
  credentialLoginInputSchema,
  credentialRegisterInputSchema
} from "@glantri/auth";
import { AuthService } from "@glantri/database";

import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  getAuthenticatedUser,
  getSessionTokenFromRequest,
  requireAdminUser,
  requireAuthenticatedUser
} from "../lib/sessionAuth";

const authService = new AuthService();

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me", async (request) => {
    const user = await getAuthenticatedUser(request, authService);
    const canBootstrapGameMaster = await authService.canBootstrapGameMaster();

    return {
      canBootstrapGameMaster,
      user
    };
  });

  app.get("/bootstrap-status", async () => {
    return {
      canBootstrapGameMaster: await authService.canBootstrapGameMaster()
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

  app.get("/users", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, authService);

    if (!user) {
      return;
    }

    const users = await authService.listUsers();

    return {
      users
    };
  });

  app.post("/users/:id/role", async (request, reply) => {
    const user = await requireAdminUser(request, reply, authService);

    if (!user) {
      return;
    }

    const candidate = request.body as { role?: unknown };
    const role = authRoleSchema.parse(candidate.role);
    const targetUserId = (request.params as { id?: string }).id;

    if (!targetUserId) {
      return reply.code(400).send({
        error: "User id is required."
      });
    }

    const updatedUser = await authService.replaceUserRoles(targetUserId, [role]);

    if (!updatedUser) {
      return reply.code(404).send({
        error: "User not found."
      });
    }

    return {
      user: updatedUser
    };
  });

  app.post("/bootstrap-gm", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply, authService);

    if (!user) {
      return;
    }

    const updatedUser = await authService.bootstrapGameMasterForUser(user.id);

    if (!updatedUser) {
      return reply.code(403).send({
        error: "Bootstrap GM claim is no longer available."
      });
    }

    return {
      canBootstrapGameMaster: false,
      user: updatedUser
    };
  });
};

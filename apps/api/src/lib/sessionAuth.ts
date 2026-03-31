import { hasRole, type AuthUser } from "@glantri/auth";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { AuthService } from "@glantri/database";

export const SESSION_COOKIE_NAME = "glantri_session";

const DEFAULT_WEB_ORIGIN = "http://localhost:3000";

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");

    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

export function applyLocalCors(app: FastifyInstance): void {
  const allowedOrigin = process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN;

  app.addHook("onRequest", async (request, reply) => {
    const requestOrigin = request.headers.origin;

    if (requestOrigin === allowedOrigin) {
      reply.header("access-control-allow-origin", allowedOrigin);
      reply.header("access-control-allow-credentials", "true");
      reply.header("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
      reply.header("access-control-allow-headers", "content-type");
      reply.header("vary", "origin");
    }

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
}

export function buildSessionCookie(token: string, expiresAt: string): string {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );

  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ].join("; ");
}

export function buildExpiredSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; ");
}

export function getSessionTokenFromRequest(request: FastifyRequest): string | undefined {
  const cookies = parseCookies(request.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

export async function getAuthenticatedUser(
  request: FastifyRequest,
  authService = new AuthService()
): Promise<AuthUser | null> {
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    return null;
  }

  return authService.getCurrentUserForToken(token);
}

export async function requireAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
  authService = new AuthService()
): Promise<AuthUser | null> {
  const user = await getAuthenticatedUser(request, authService);

  if (!user) {
    await reply.code(401).send({
      error: "Authentication required."
    });
    return null;
  }

  return user;
}

export async function requireAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  authService = new AuthService()
): Promise<AuthUser | null> {
  const user = await requireAuthenticatedUser(request, reply, authService);

  if (!user) {
    return null;
  }

  if (!hasRole(user.roles, "admin")) {
    await reply.code(403).send({
      error: "Admin role required."
    });
    return null;
  }

  return user;
}

import { canAccessAdmin, isAdmin, type AuthUser } from "@glantri/auth";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { AuthService } from "@glantri/database";

import { recordCombatPerformanceCheckpoint } from "./combatPerformance";

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
      reply.header("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      reply.header(
        "access-control-allow-headers",
        "content-type,x-glantri-artifact-mutation,x-glantri-blackboard-mutation,x-glantri-map-mutation,x-glantri-combat-command,x-glantri-combat-correlation-id,x-glantri-combat-response",
      );
      reply.header("vary", "origin");
    }

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
}

export type SessionCookieSecurityPosture = {
  readonly sameSite: "Lax" | "None";
  readonly secure: boolean;
};

/**
 * Cross-site secure posture. Required for an HTTPS deployment where the Web
 * origin and the API origin are genuinely cross-site (the Azure topology), and
 * used as the default whenever the browser-facing scheme cannot be established.
 */
const SECURE_CROSS_SITE_POSTURE: SessionCookieSecurityPosture = {
  sameSite: "None",
  secure: true,
};

/**
 * Plain-HTTP posture. `SameSite=None` is rejected without `Secure` in current
 * browsers, so a non-HTTPS deployment cannot use it and must fall back to
 * `SameSite=Lax`. That is sufficient for the local production-like topology,
 * where the Web and API origins differ only by port and are therefore same-site,
 * and it matches the posture the non-production branch has always emitted. A
 * genuinely cross-site deployment cannot be served over plain HTTP at all,
 * because no `SameSite` value carries a cookie cross-site without `Secure`.
 */
const PLAIN_HTTP_SAME_SITE_POSTURE: SessionCookieSecurityPosture = {
  sameSite: "Lax",
  secure: false,
};

/**
 * The session cookie's security posture follows the scheme the browser actually
 * uses to reach the Web application, not `NODE_ENV`. `NODE_ENV=production` does
 * not imply HTTPS, and a `Secure` cookie emitted over a plain-HTTP origin is
 * dropped by any browser that does not grant an explicit localhost exemption.
 *
 * The secure posture stays the default: it is relaxed only when a production
 * deployment explicitly configures an origin whose scheme is `http:`.
 */
export function resolveSessionCookieSecurityPosture(
  nodeEnv: string | undefined,
  webOrigin: string | undefined,
): SessionCookieSecurityPosture {
  if (nodeEnv !== "production") {
    return PLAIN_HTTP_SAME_SITE_POSTURE;
  }

  if (webOrigin === undefined || webOrigin.trim() === "") {
    return SECURE_CROSS_SITE_POSTURE;
  }

  let scheme: string;

  try {
    scheme = new URL(webOrigin).protocol;
  } catch {
    return SECURE_CROSS_SITE_POSTURE;
  }

  return scheme === "http:" ? PLAIN_HTTP_SAME_SITE_POSTURE : SECURE_CROSS_SITE_POSTURE;
}

const sessionCookieSecurityPosture = resolveSessionCookieSecurityPosture(
  process.env.NODE_ENV,
  process.env.WEB_ORIGIN,
);

if (process.env.NODE_ENV === "production" && !sessionCookieSecurityPosture.secure) {
  process.stderr.write(
    JSON.stringify({
      level: "warn",
      msg: "Session cookies are issued without Secure because WEB_ORIGIN uses the http scheme. Serve the Web application over HTTPS for a public deployment.",
    }) + "\n",
  );
}

function sessionCookieParts(valuePart: string, maxAgePart: string): string[] {
  const parts = [
    valuePart,
    "HttpOnly",
    "Path=/",
    `SameSite=${sessionCookieSecurityPosture.sameSite}`,
    maxAgePart,
  ];

  if (sessionCookieSecurityPosture.secure) {
    parts.push("Secure");
  }

  return parts;
}

export function buildSessionCookie(token: string, expiresAt: string): string {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );

  return sessionCookieParts(
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAgeSeconds}`,
  ).join("; ");
}

export function buildExpiredSessionCookie(): string {
  return sessionCookieParts(`${SESSION_COOKIE_NAME}=`, "Max-Age=0").join("; ");
}

export function getSessionTokenFromRequest(request: FastifyRequest): string | undefined {
  const cookies = parseCookies(request.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

export async function getAuthenticatedUser(
  request: FastifyRequest,
  authService = new AuthService(),
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
  authService = new AuthService(),
): Promise<AuthUser | null> {
  const user = await getAuthenticatedUser(request, authService);
  recordCombatPerformanceCheckpoint("authentication_complete");

  if (!user) {
    await reply.code(401).send({
      error: "Authentication required.",
    });
    return null;
  }

  return user;
}

export async function requireAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  authService = new AuthService(),
): Promise<AuthUser | null> {
  const user = await requireAuthenticatedUser(request, reply, authService);

  if (!user) {
    return null;
  }

  if (!canAccessAdmin(user.roles)) {
    await reply.code(403).send({
      error: "Admin or GM role required.",
    });
    return null;
  }

  return user;
}

export async function requireStrictAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  authService = new AuthService(),
): Promise<AuthUser | null> {
  const user = await requireAuthenticatedUser(request, reply, authService);

  if (!user) {
    return null;
  }

  if (!isAdmin(user.roles)) {
    await reply.code(403).send({
      error: "Admin role required.",
    });
    return null;
  }

  return user;
}

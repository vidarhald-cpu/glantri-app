import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Forgejo #1048 (A1): the app-level error handler. Errors that escape a route before its own
 * `try` (the auth lookup) or from routes with no `try` must reach the client as the fixed body,
 * never Fastify's default `{code,message}` echo of the Prisma text. Every other error keeps
 * Fastify's default reply byte-for-byte.
 */

const mocks = vi.hoisted(() => ({ requireAuthenticatedUser: vi.fn() }));

vi.mock("./lib/sessionAuth", async (importActual) => ({
  ...(await importActual<typeof import("./lib/sessionAuth")>()),
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { CLIENT_SAFE_INTERNAL_ERROR_MESSAGE } from "./lib/errors";
import { buildApiServer } from "./app";

const LEAK_PATH = "/Users/someone/node_modules/.prisma/authRepository.js:154:50";

function prismaError(name: string, code: string | undefined, message: string): Error {
  const error = new Error(message) as Error & { code?: string };
  error.name = name;
  if (code) error.code = code;
  return error;
}

const connectionFailure = () =>
  prismaError(
    "PrismaClientKnownRequestError",
    "P1017",
    `Invalid \`prisma.session.findFirst()\` invocation in ${LEAK_PATH}\n\nServer has closed the connection.`,
  );
const missingTable = () =>
  prismaError(
    "PrismaClientKnownRequestError",
    "P2021",
    `Invalid \`prisma.x.findMany()\` invocation in ${LEAK_PATH}\n\nThe table \`public.x\` does not exist`,
  );
const initFailure = () =>
  prismaError(
    "PrismaClientInitializationError",
    undefined,
    `Invalid \`prisma.session.findFirst()\` invocation in ${LEAK_PATH}\n\nCan't reach database server`,
  );

const FIXED = { error: CLIENT_SAFE_INTERNAL_ERROR_MESSAGE };

describe("app-level error handler (#1048 A1)", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    vi.stubEnv("LOG_LEVEL", "silent");
    mocks.requireAuthenticatedUser.mockReset();
    app = buildApiServer();
  });
  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  const routes = [
    "/encounters/enc-1", // auth before the route's own try, encapsulated scenarios plugin
    "/characters", // no try
    "/chargen/rule-sets", // no try
    "/characters/char-1/equipment", // second plugin sharing the /characters prefix
  ];

  for (const [label, make] of [
    ["P1017 connection failure", connectionFailure],
    ["P2021 missing table", missingTable],
    ["PrismaClientInitializationError", initFailure],
  ] as const) {
    for (const url of routes) {
      it(`${url} answers ${label} with the fixed 500 body`, async () => {
        mocks.requireAuthenticatedUser.mockRejectedValue(make());
        const response = await app.inject({ method: "GET", url });
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual(FIXED);
        expect(response.body).not.toContain(LEAK_PATH);
        expect(response.body).not.toMatch(/P1017|P2021|prisma/i);
      });
    }
  }

  it("keeps Fastify's default reply byte-for-byte for non-internal errors", async () => {
    const attach = (instance: FastifyInstance) => {
      instance.get(
        "/probe/validation",
        {
          schema: {
            querystring: {
              type: "object",
              required: ["n"],
              properties: { n: { type: "integer" } },
            },
          },
        },
        async () => ({ ok: true }),
      );
      instance.get("/probe/status/:code", async (request) => {
        const code = Number((request.params as { code: string }).code);
        throw Object.assign(new Error(`boom ${code}`), { statusCode: code });
      });
      instance.get("/probe/plain", async () => {
        throw new Error("plain error");
      });
      instance.get("/probe/rangeerror", async () => {
        throw new RangeError("range");
      });
      instance.post("/probe/json", async () => ({ ok: true }));
    };
    const baseline = Fastify({ logger: false });
    attach(baseline);
    attach(app);

    const requests = [
      { method: "GET", url: "/probe/validation" },
      { method: "GET", url: "/probe/validation?n=abc" },
      { method: "GET", url: "/probe/status/400" },
      { method: "GET", url: "/probe/status/404" },
      { method: "GET", url: "/probe/status/413" },
      { method: "GET", url: "/probe/status/415" },
      { method: "GET", url: "/probe/plain" },
      { method: "GET", url: "/probe/rangeerror" },
      { method: "GET", url: "/no/such/route" },
      {
        method: "POST",
        url: "/probe/json",
        payload: "{bad",
        headers: { "content-type": "application/json" },
      },
      {
        method: "POST",
        url: "/probe/json",
        payload: "x",
        headers: { "content-type": "text/plain" },
      },
    ] as const;

    for (const request of requests) {
      const expected = await baseline.inject(request);
      const actual = await app.inject(request);
      expect(actual.statusCode, `${request.method} ${request.url}`).toBe(expected.statusCode);
      expect(actual.body, `${request.method} ${request.url}`).toBe(expected.body);
      expect(actual.headers["content-type"]).toBe(expected.headers["content-type"]);
    }
    expect((await app.inject({ method: "GET", url: "/probe/validation" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/no/such/route" })).statusCode).toBe(404);
    await baseline.close();
  });
});

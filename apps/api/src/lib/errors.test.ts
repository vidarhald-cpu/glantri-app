import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Writable } from "node:stream";

import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { encounterSessionSchema } from "@glantri/domain";

import {
  BadRequestError,
  CLIENT_SAFE_INTERNAL_ERROR_MESSAGE,
  ConflictError,
  NotFoundError,
  handleRouteError,
  isInternalServerError,
} from "./errors";

/**
 * Forgejo #1048: `handleRouteError` answered every plain `Error` with its own message as a 400, so a
 * Prisma failure reached the client with its query text and a server file path. Internal failures
 * now get one fixed client-safe 500 body and the detail goes to the server log; every deliberate
 * message keeps its exact status and body.
 */

// The genuine Prisma runtime classes, resolved from the database package that owns the dependency.
const prismaRuntime = createRequire(
  resolve(__dirname, "../../../../packages/database/package.json"),
)("@prisma/client/runtime/library") as {
  PrismaClientKnownRequestError: new (
    message: string,
    params: { clientVersion: string; code: string },
  ) => Error;
  PrismaClientValidationError: new (message: string, params: { clientVersion: string }) => Error;
};

const SERVER_PATH = "/srv/glantri/packages/database/src/repositories/encounterRepository.ts";

// The shape of a real Prisma validation message: the invocation, the server path and a source excerpt.
const prismaValidationError = new prismaRuntime.PrismaClientValidationError(
  `\nInvalid \`prisma.encounter.findUnique()\` invocation in\n${SERVER_PATH}:41:28\n\n→ 41 () => prisma.encounter.findUnique({ where: { id: 42 } })\n\nArgument \`id\`: Invalid value provided. Expected String, provided Int.`,
  { clientVersion: "6.19.2" },
);
const prismaTransactionError = new prismaRuntime.PrismaClientKnownRequestError(
  `\nInvalid \`prisma.$transaction()\` invocation in\n${SERVER_PATH}:88:5\n\nTransaction API error: Unable to start a transaction in the given time.`,
  { clientVersion: "6.19.2", code: "P2028" },
);

function systemError(): Error {
  return Object.assign(new Error(`ENOENT: no such file or directory, open '${SERVER_PATH}'`), {
    code: "ENOENT",
    errno: -2,
    path: SERVER_PATH,
    syscall: "open",
  });
}

function zodError(): Error {
  const result = encounterSessionSchema.safeParse({ id: 7 });
  if (result.success) throw new Error("expected a ZodError fixture");
  return result.error;
}

describe("handleRouteError (#1048)", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];
  let logLines: string[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    logLines = [];
  });

  async function respond(error: unknown) {
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logLines.push(String(chunk));
        callback();
      },
    });
    const app = Fastify({ logger: { level: "error", stream } });
    apps.push(app);
    app.get("/probe", async (_request, reply) => handleRouteError(error, reply));
    const response = await app.inject({ method: "GET", url: "/probe" });
    return { body: response.body, json: response.json(), status: response.statusCode };
  }

  it.each([
    ["Prisma validation error with a server path", prismaValidationError],
    ["Prisma transaction error", prismaTransactionError],
    ["TypeError", new TypeError("Cannot read properties of undefined (reading 'scenarioId')")],
    ["ReferenceError", new ReferenceError("encounterRow is not defined")],
    ["Node.js system error", systemError()],
  ])("answers a %s with the fixed client-safe 500 and logs the detail", async (_label, error) => {
    const response = await respond(error);

    expect(response.status).toBe(500);
    expect(response.json).toEqual({ error: CLIENT_SAFE_INTERNAL_ERROR_MESSAGE });
    expect(response.body).not.toContain("prisma");
    expect(response.body).not.toContain("/srv/");
    expect(response.body).not.toContain("invocation");
    expect(response.body).not.toContain(" at ");

    const logged = logLines.join("");
    expect(logged).toContain("api_route_internal_error");
    expect(logged).toContain(JSON.stringify((error as Error).message).slice(1, -1));
    expect(logged).toContain('"stack"');
  });

  it.each([
    [
      "NotFoundError",
      new NotFoundError("Character not found."),
      404,
      { error: "Character not found." },
    ],
    [
      "ConflictError",
      new ConflictError("Character equipment changed. Reload it before trying again."),
      409,
      { error: "Character equipment changed. Reload it before trying again." },
    ],
    [
      "BadRequestError with details",
      new BadRequestError("Character build validation failed.", { issues: ["Name is required."] }),
      400,
      { error: "Character build validation failed.", issues: ["Name is required."] },
    ],
    [
      "deliberate plain Error",
      new Error("Equipment template not found."),
      400,
      { error: "Equipment template not found." },
    ],
    [
      "deliberate plain Error naming a reference",
      new Error("Cannot remove item because it is referenced by the active loadout."),
      400,
      { error: "Cannot remove item because it is referenced by the active loadout." },
    ],
    [
      "deliberate RangeError",
      new RangeError("Choose an existing Skill for this Combat action."),
      400,
      { error: "Choose an existing Skill for this Combat action." },
    ],
  ])("keeps a %s byte-for-byte", async (_label, error, status, body) => {
    const response = await respond(error);

    expect(response.status).toBe(status);
    expect(response.body).toBe(JSON.stringify(body));
    expect(logLines).toEqual([]);
  });

  it("keeps a ZodError's 400 and message unchanged", async () => {
    const error = zodError();
    const response = await respond(error);

    expect(response.status).toBe(400);
    expect(response.body).toBe(JSON.stringify({ error: error.message }));
  });

  it("classifies only internal failures as internal", () => {
    expect(isInternalServerError(prismaValidationError)).toBe(true);
    expect(isInternalServerError(prismaTransactionError)).toBe(true);
    expect(isInternalServerError(new TypeError("x"))).toBe(true);
    expect(isInternalServerError(systemError())).toBe(true);
    expect(isInternalServerError(new Error("Campaign item not found."))).toBe(false);
    expect(isInternalServerError(new RangeError("Dodge skill is unavailable."))).toBe(false);
    expect(isInternalServerError(new BadRequestError("x"))).toBe(false);
    expect(isInternalServerError(zodError())).toBe(false);
    expect(isInternalServerError("string")).toBe(false);
  });
});

// Regression test for Forgejo #276 -- two simultaneous task-isolated stacks must not cross-talk.
//
// The incident this test exists to prevent was not a crash. A second stack started successfully,
// bound a wildcard address alongside a first stack's loopback listener, lost the loopback traffic
// to it, and the second stack's frontend then wrote through the first stack's API into the first
// stack's database. Nothing failed. So every assertion here is about a *loud* failure, or about
// traffic provably reaching the right stack -- never merely about a process starting.

import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createSocketServer, type Server as SocketServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isWildcardHost, resolveApiBinding } from "../../apps/api/src/lib/serverBinding";
import {
  assertNoTaskStackEnvironmentConflict,
  assertTaskStackPortsAvailable,
  deriveTaskStackAddresses,
  deriveTaskStackPorts,
  probeTaskStackPort,
  taskStackEnvironment,
  TASK_STACK_LOOPBACK_HOST,
} from "./taskStackEnvironment";

// Two worktree keys of the shape the real derivation produces for a Builder and a QA lane on the
// same issue -- exactly the pair that collided in #271.
const BUILDER_KEY = "glantri-276-builder-a1b2c3d4";
const QA_KEY = "glantri-276-qa-e5f6a7b8";

function stackEnvironmentFor(worktreeKey: string) {
  const addresses = deriveTaskStackAddresses(worktreeKey);
  return { addresses, environment: taskStackEnvironment(addresses) };
}

/** Starts a server that answers with its own stack identity, bound exactly as the stack env says. */
async function startStack(worktreeKey: string) {
  const { addresses, environment } = stackEnvironmentFor(worktreeKey);
  const binding = resolveApiBinding({ ...environment, GLANTRI_DB_MODE: "task" });
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ database: `db_${worktreeKey}`, worktreeKey }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: binding.host, port: binding.port }, () => resolve());
  });

  return {
    addresses,
    binding,
    environment,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
    worktreeKey,
  };
}

async function identityAt(baseUrl: string): Promise<{ database: string; worktreeKey: string }> {
  const response = await fetch(baseUrl);
  expect(response.status).toBe(200);
  return (await response.json()) as { database: string; worktreeKey: string };
}

function holdLoopbackPort(port: number): Promise<() => Promise<void>> {
  const server: SocketServer = createSocketServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: TASK_STACK_LOOPBACK_HOST, port }, () =>
      resolve(() => new Promise<void>((done) => server.close(() => done()))),
    );
  });
}

describe("task-isolated dev stacks", () => {
  it("lets two simultaneous stacks reach only their own API and only their own database", async () => {
    const builder = await startStack(BUILDER_KEY);
    const qa = await startStack(QA_KEY);

    try {
      expect(builder.addresses.apiPort).not.toBe(qa.addresses.apiPort);
      expect(builder.addresses.webPort).not.toBe(qa.addresses.webPort);

      // A frontend's only knowledge of its API is NEXT_PUBLIC_API_BASE_URL, so that is the hop
      // this test follows. It is the hop that misrouted in #271.
      const builderSeen = await identityAt(builder.environment.NEXT_PUBLIC_API_BASE_URL!);
      const qaSeen = await identityAt(qa.environment.NEXT_PUBLIC_API_BASE_URL!);

      expect(builderSeen).toEqual({ database: `db_${BUILDER_KEY}`, worktreeKey: BUILDER_KEY });
      expect(qaSeen).toEqual({ database: `db_${QA_KEY}`, worktreeKey: QA_KEY });

      // The API each stack advertises is the one it is actually serving from.
      expect(builder.environment.NEXT_PUBLIC_API_BASE_URL).toBe(
        `http://${builder.binding.host}:${builder.binding.port}`,
      );
      expect(qa.environment.NEXT_PUBLIC_API_BASE_URL).toBe(
        `http://${qa.binding.host}:${qa.binding.port}`,
      );

      // Each API's allowed origin is its own Web origin, byte-identical, so one stack cannot be
      // driven from the other stack's frontend.
      expect(builder.environment.WEB_ORIGIN).toBe(
        `http://${TASK_STACK_LOOPBACK_HOST}:${builder.addresses.webPort}`,
      );
      expect(builder.environment.WEB_ORIGIN).not.toBe(qa.environment.WEB_ORIGIN);
    } finally {
      await builder.stop();
      await qa.stop();
    }
  });

  it("turns a port collision into a loud failure instead of a silent redirection", async () => {
    const { addresses } = stackEnvironmentFor(BUILDER_KEY);
    const release = await holdLoopbackPort(addresses.apiPort);

    try {
      await expect(probeTaskStackPort(addresses.apiPort)).resolves.toMatchObject({ free: false });

      // Before any stack process is spawned.
      await expect(assertTaskStackPortsAvailable(addresses)).rejects.toThrow(
        new RegExp(
          `Refusing to start a task-isolated stack on a contended port[\\s\\S]*API port ${addresses.apiPort}`,
        ),
      );
    } finally {
      await release();
    }
  });

  it("refuses a wildcard bind for a task stack, because it can lose the race silently", () => {
    // The base behaviour was `process.env.API_HOST ?? "0.0.0.0"`. On BSD/macOS that bind SUCCEEDS
    // while another process holds 127.0.0.1 on the same port, which is why the #271 lane saw no
    // error at all.
    expect(isWildcardHost("0.0.0.0")).toBe(true);
    expect(isWildcardHost("::")).toBe(true);
    expect(isWildcardHost("127.0.0.1")).toBe(false);

    expect(() =>
      resolveApiBinding({ API_HOST: "0.0.0.0", API_PORT: "4000", GLANTRI_DB_MODE: "task" }),
    ).toThrow(/wildcard address and is refused/);
    expect(() => resolveApiBinding({ API_PORT: "4000", GLANTRI_DB_MODE: "task" })).toThrow(
      /API_HOST must be set explicitly/,
    );
    expect(() => resolveApiBinding({ API_HOST: "127.0.0.1", GLANTRI_DB_MODE: "task" })).toThrow(
      /API_PORT must be set explicitly/,
    );

    // The container path is unchanged: without GLANTRI_DB_MODE=task the wildcard default stands,
    // so `docker run -p 4000:4000` keeps working.
    expect(resolveApiBinding({})).toEqual({ host: "0.0.0.0", port: 4000 });
    expect(resolveApiBinding({ API_HOST: "127.0.0.1", API_PORT: "4242" })).toEqual({
      host: "127.0.0.1",
      port: 4242,
    });
  });

  it("refuses an inherited stack variable from another lane rather than preferring it", () => {
    const { environment } = stackEnvironmentFor(BUILDER_KEY);
    const foreign = stackEnvironmentFor(QA_KEY).environment;

    expect(() =>
      assertNoTaskStackEnvironmentConflict(environment, { PATH: "/usr/bin" }),
    ).not.toThrow();
    expect(() =>
      assertNoTaskStackEnvironmentConflict(environment, {
        NEXT_PUBLIC_API_BASE_URL: foreign.NEXT_PUBLIC_API_BASE_URL,
      }),
    ).toThrow(/conflicts with this worktree's task stack value/);
  });

  it("derives deterministic, paired, distinct ports outside the shared defaults", () => {
    expect(deriveTaskStackPorts(BUILDER_KEY)).toEqual(deriveTaskStackPorts(BUILDER_KEY));

    for (const key of [BUILDER_KEY, QA_KEY]) {
      const { apiPort, webPort } = deriveTaskStackPorts(key);
      expect(apiPort).toBeGreaterThanOrEqual(4100);
      expect(apiPort).toBeLessThanOrEqual(4499);
      expect(webPort).toBeGreaterThanOrEqual(3100);
      expect(webPort).toBeLessThanOrEqual(3499);
      expect(apiPort).not.toBe(webPort);
      // Never the shared defaults #276 collided on, and never inside the ephemeral range.
      expect(apiPort).not.toBe(4000);
      expect(webPort).not.toBe(3000);
      expect(apiPort).toBeLessThan(49152);
    }

    // The documented escape hatch for a derived-port collision, which is a routine event on a
    // machine running dozens of lanes rather than a 1-in-400 curiosity.
    expect(
      deriveTaskStackPorts(BUILDER_KEY, {
        GLANTRI_TASK_API_PORT: "4777",
        GLANTRI_TASK_WEB_PORT: "3777",
      }),
    ).toEqual({ apiPort: 4777, webPort: 3777 });
    expect(() => deriveTaskStackPorts(BUILDER_KEY, { GLANTRI_TASK_API_PORT: "0" })).toThrow(
      /must be an integer between 1 and 65535/,
    );
  });
});

// The browser proof suite is a second, equally live hop into a database. `global-setup.ts` seeds
// accounts with POST /auth/register before a single spec runs, and it learns where to send them
// only from PLAYWRIGHT_API_URL, whose fallback is the shared `http://localhost:4000` default.
// While a task stack sat on the shared defaults that fallback happened to be right. Once the
// stack moved to its derived ports, an unpropagated Playwright URL stopped being "unconfigured"
// and became a deterministic misroute into whatever holds the shared port -- normally the primary
// checkout's API on the shared playtest database. So these URLs are stack identity, not test
// configuration, and they are asserted to equal the stack's own addresses.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const E2E_DIRECTORY = join(repositoryRoot, "apps", "web", "e2e");
const PLAYWRIGHT_CONFIG = join(repositoryRoot, "apps", "web", "playwright.config.ts");

/** Every `process.env.X ?? "http://localhost:<port>"` in the browser suite -- the defect shape. */
function browserSuiteVariablesWithSharedDefaultFallback(): Map<string, Set<string>> {
  const sources = [
    PLAYWRIGHT_CONFIG,
    ...readdirSync(E2E_DIRECTORY)
      .filter((entry) => entry.endsWith(".ts"))
      .map((entry) => join(E2E_DIRECTORY, entry)),
  ];
  const found = new Map<string, Set<string>>();

  for (const source of sources) {
    const pattern = /process\.env\.([A-Z0-9_]+)\s*\?\?\s*"(http:\/\/localhost:\d+)"/g;
    for (const match of readFileSync(source, "utf8").matchAll(pattern)) {
      const [, name, fallback] = match as unknown as [string, string, string];
      found.set(name, (found.get(name) ?? new Set<string>()).add(fallback));
    }
  }

  return found;
}

describe("task stack Playwright propagation", () => {
  it("propagates Playwright URLs that are exactly the stack's own Web and API addresses", () => {
    const { addresses, environment } = stackEnvironmentFor(BUILDER_KEY);

    // Equality with the stack's own addresses, not merely "set": a value that is present but
    // points somewhere else is the whole failure mode.
    expect(environment.PLAYWRIGHT_BASE_URL).toBe(
      `http://${TASK_STACK_LOOPBACK_HOST}:${addresses.webPort}`,
    );
    expect(environment.PLAYWRIGHT_API_URL).toBe(
      `http://${TASK_STACK_LOOPBACK_HOST}:${addresses.apiPort}`,
    );
    expect(environment.PLAYWRIGHT_BROWSER_API_URL).toBe(
      `http://${TASK_STACK_LOOPBACK_HOST}:${addresses.apiPort}`,
    );

    // Derived from the same addresses, so they cannot drift from what the stack actually binds
    // or from what the frontend is told.
    expect(environment.PLAYWRIGHT_BASE_URL).toBe(environment.WEB_ORIGIN);
    expect(environment.PLAYWRIGHT_API_URL).toBe(environment.NEXT_PUBLIC_API_BASE_URL);
    expect(environment.PLAYWRIGHT_BROWSER_API_URL).toBe(environment.NEXT_PUBLIC_API_BASE_URL);

    // Never the shared defaults, and never the `localhost` name, which can resolve to ::1 and
    // reach a foreign listener even when the numeric port is this stack's own.
    for (const name of [
      "PLAYWRIGHT_API_URL",
      "PLAYWRIGHT_BASE_URL",
      "PLAYWRIGHT_BROWSER_API_URL",
    ]) {
      expect(environment[name]).not.toContain("localhost");
      expect(environment[name]).not.toBe("http://localhost:4000");
      expect(environment[name]).not.toBe("http://localhost:3000");
    }
  });

  it("gives two simultaneous lanes disjoint Playwright targets", () => {
    const builder = stackEnvironmentFor(BUILDER_KEY).environment;
    const qa = stackEnvironmentFor(QA_KEY).environment;

    expect(builder.PLAYWRIGHT_API_URL).not.toBe(qa.PLAYWRIGHT_API_URL);
    expect(builder.PLAYWRIGHT_BASE_URL).not.toBe(qa.PLAYWRIGHT_BASE_URL);

    // A Playwright URL inherited from another lane is ambiguous in the same way an inherited
    // DATABASE_URL is, so it is refused rather than silently preferred.
    expect(() =>
      assertNoTaskStackEnvironmentConflict(builder, {
        PLAYWRIGHT_API_URL: qa.PLAYWRIGHT_API_URL,
      }),
    ).toThrow(/conflicts with this worktree's task stack value/);
  });

  it("propagates every browser-suite variable that falls back to a shared default port", () => {
    const observed = browserSuiteVariablesWithSharedDefaultFallback();
    const propagated = stackEnvironmentFor(BUILDER_KEY).environment;

    // Guards the guard: if this ever finds nothing the assertion below would pass vacuously.
    expect(observed.size).toBeGreaterThanOrEqual(3);
    expect([...observed.keys()].sort()).toEqual([
      "PLAYWRIGHT_API_URL",
      "PLAYWRIGHT_BASE_URL",
      "PLAYWRIGHT_BROWSER_API_URL",
    ]);

    // Any browser-suite entry point whose fallback is a shared default port must be steered by
    // db:task:exec. A new one added without propagation fails here rather than in production.
    for (const name of observed.keys()) {
      expect(Object.keys(propagated)).toContain(name);
    }
  });
});

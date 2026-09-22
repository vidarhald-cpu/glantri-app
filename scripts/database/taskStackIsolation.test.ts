// Regression test for Forgejo #276 -- two simultaneous task-isolated stacks must not cross-talk.
//
// The incident this test exists to prevent was not a crash. A second stack started successfully,
// bound a wildcard address alongside a first stack's loopback listener, lost the loopback traffic
// to it, and the second stack's frontend then wrote through the first stack's API into the first
// stack's database. Nothing failed. So every assertion here is about a *loud* failure, or about
// traffic provably reaching the right stack -- never merely about a process starting.

import { createServer } from "node:http";
import { createServer as createSocketServer, type Server as SocketServer } from "node:net";

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

    // The documented escape hatch for the rare derived-port collision.
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

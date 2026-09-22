import { createHash } from "node:crypto";
import { createConnection, createServer } from "node:net";

// Every task-isolated dev stack must own its own loopback ports. The #276 incident showed that
// when a stack keeps the shared defaults (API 4000, Web 3000) it does not merely fail to start:
// a wildcard bind can *succeed* alongside another stack's more specific loopback listener, and
// the browser-facing base URL then resolves to whichever stack owns the specific bind. The
// second stack loses the race with no error, and its writes land in the first stack's database.
//
// Ports are therefore derived from the same full resolved worktree path that already derives the
// disposable database identity, so the port set and the database target cannot drift apart.

export const TASK_STACK_LOOPBACK_HOST = "127.0.0.1";

// Two adjacent 400-port windows, clear of the shared 3000/4000 defaults and clear of the macOS
// ephemeral range (49152-65535), so a derived port is never handed out by the kernel to an
// unrelated socket while the stack is down.
const WEB_PORT_BASE = 3100;
const API_PORT_BASE = 4100;
const PORT_WINDOW = 400;

export interface TaskStackPorts {
  apiPort: number;
  webPort: number;
}

export interface TaskStackAddresses extends TaskStackPorts {
  apiBaseUrl: string;
  host: string;
  webOrigin: string;
}

function parseExplicitPort(name: string, value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const port = Number(value.trim());

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535; received "${value}".`);
  }

  return port;
}

/**
 * Derives this worktree's stack ports. Deterministic, so the same worktree always reaches the
 * same URLs, and distinct for distinct worktree keys except for a 1-in-400 window collision,
 * which `assertTaskStackPortsAvailable` turns into a loud startup failure rather than a silent
 * redirection. `GLANTRI_TASK_API_PORT` / `GLANTRI_TASK_WEB_PORT` are the supported escape hatch.
 */
export function deriveTaskStackPorts(
  worktreeKey: string,
  environment: NodeJS.ProcessEnv = {},
): TaskStackPorts {
  if (!worktreeKey.trim()) {
    throw new Error("A worktree key is required to derive task stack ports.");
  }

  const digest = createHash("sha256").update(worktreeKey).digest();
  const offset = digest.readUInt16BE(0) % PORT_WINDOW;

  const apiPort =
    parseExplicitPort("GLANTRI_TASK_API_PORT", environment.GLANTRI_TASK_API_PORT) ??
    API_PORT_BASE + offset;
  const webPort =
    parseExplicitPort("GLANTRI_TASK_WEB_PORT", environment.GLANTRI_TASK_WEB_PORT) ??
    WEB_PORT_BASE + offset;

  if (apiPort === webPort) {
    throw new Error(
      `The task stack API and Web ports must differ; both resolved to ${apiPort}. Set GLANTRI_TASK_API_PORT and GLANTRI_TASK_WEB_PORT to distinct values.`,
    );
  }

  return { apiPort, webPort };
}

export function deriveTaskStackAddresses(
  worktreeKey: string,
  environment: NodeJS.ProcessEnv = {},
): TaskStackAddresses {
  const { apiPort, webPort } = deriveTaskStackPorts(worktreeKey, environment);

  // The loopback literal is used for the bind address *and* for both browser-facing URLs so the
  // API's allowed origin is byte-identical to the origin the browser actually sends. `localhost`
  // is deliberately avoided: it can resolve to ::1 or 127.0.0.1 depending on the resolver, which
  // reintroduces exactly the address ambiguity this change exists to remove. 127.0.0.1 is still
  // a secure context, so Web Crypto keeps working.
  return {
    apiBaseUrl: `http://${TASK_STACK_LOOPBACK_HOST}:${apiPort}`,
    apiPort,
    host: TASK_STACK_LOOPBACK_HOST,
    webOrigin: `http://${TASK_STACK_LOOPBACK_HOST}:${webPort}`,
    webPort,
  };
}

/**
 * The variables `db:task:exec` must place in the child environment so the whole stack — the API
 * bind, the Web bind, the browser's API base URL, and the API's allowed origin — agrees on one
 * set of task-owned loopback addresses.
 */
export function taskStackEnvironment(addresses: TaskStackAddresses): Record<string, string> {
  return {
    API_HOST: addresses.host,
    API_PORT: String(addresses.apiPort),
    GLANTRI_TASK_API_PORT: String(addresses.apiPort),
    GLANTRI_TASK_WEB_PORT: String(addresses.webPort),
    NEXT_PUBLIC_API_BASE_URL: addresses.apiBaseUrl,
    WEB_HOST: addresses.host,
    WEB_ORIGIN: addresses.webOrigin,
    WEB_PORT: String(addresses.webPort),
  };
}

/**
 * An inherited value that disagrees with this worktree's own stack is exactly how the #271 lane
 * ended up talking to another stack's API, so it is refused rather than silently preferred in
 * either direction.
 */
export function assertNoTaskStackEnvironmentConflict(
  stack: Record<string, string>,
  inherited: NodeJS.ProcessEnv,
): void {
  for (const [name, expected] of Object.entries(stack)) {
    const present = inherited[name];

    if (present && present !== expected) {
      throw new Error(
        `${name}=${present} conflicts with this worktree's task stack value ${expected}. Clear the inherited value, or set GLANTRI_TASK_API_PORT / GLANTRI_TASK_WEB_PORT deliberately; the stack target is ambiguous.`,
      );
    }
  }
}

function attemptLoopbackBind(port: number): Promise<string | null> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => resolve(error.code ?? "EUNKNOWN"));
    // Explicit loopback, never a wildcard: on BSD/macOS a wildcard bind is allowed to coexist
    // with another process's specific 127.0.0.1 listener, so a wildcard probe would report the
    // port free while the traffic still belongs to the other process.
    server.listen({ host: TASK_STACK_LOOPBACK_HOST, port }, () => {
      server.close(() => resolve(null));
    });
  });
}

function attemptLoopbackConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: TASK_STACK_LOOPBACK_HOST, port });
    const settle = (listening: boolean) => {
      socket.destroy();
      resolve(listening);
    };

    socket.setTimeout(500);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

export interface TaskStackPortProbe {
  free: boolean;
  port: number;
  reason?: string;
}

/**
 * Two complementary checks, because neither alone is sufficient:
 *
 * - the bind catches a process holding this exact loopback address;
 * - the connect catches a process holding the port through a *wildcard* bind, which on macOS can
 *   still allow our own loopback bind to succeed while the kernel keeps delivering loopback
 *   traffic to the wildcard owner.
 *
 * The probe itself never binds a wildcard address.
 */
export async function probeTaskStackPort(port: number): Promise<TaskStackPortProbe> {
  if (await attemptLoopbackConnect(port)) {
    return {
      free: false,
      port,
      reason: `another process is already accepting connections on ${TASK_STACK_LOOPBACK_HOST}:${port}`,
    };
  }

  const bindFailure = await attemptLoopbackBind(port);

  if (bindFailure) {
    return {
      free: false,
      port,
      reason: `${TASK_STACK_LOOPBACK_HOST}:${port} cannot be bound (${bindFailure})`,
    };
  }

  return { free: true, port };
}

/**
 * Fails fast, before a single stack process is spawned. Proceeding past a held port is the
 * failure mode of #276: the stack would come up, appear healthy, and quietly serve or consume
 * another stack's traffic.
 */
export async function assertTaskStackPortsAvailable(addresses: TaskStackAddresses): Promise<void> {
  const contended: TaskStackPortProbe[] = [];

  for (const [role, port] of [
    ["API", addresses.apiPort],
    ["Web", addresses.webPort],
  ] as const) {
    const probe = await probeTaskStackPort(port);

    if (!probe.free) {
      contended.push({ ...probe, reason: `${role} port ${port}: ${probe.reason}` });
    }
  }

  if (contended.length > 0) {
    throw new Error(
      [
        "Refusing to start a task-isolated stack on a contended port.",
        ...contended.map((probe) => `  - ${probe.reason}`),
        "Stop the process that holds the port, or set GLANTRI_TASK_API_PORT / GLANTRI_TASK_WEB_PORT to free ports.",
        "Continuing would let this stack exchange traffic with another stack and write into its database.",
      ].join("\n"),
    );
  }
}

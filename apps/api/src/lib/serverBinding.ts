// Where the API server is allowed to listen.
//
// A wildcard bind is correct in a container, where the process owns the whole network namespace
// and the port must be reachable from outside it. It is actively dangerous on a developer machine
// running more than one stack: on BSD/macOS a wildcard bind succeeds even when another process
// already holds the same port on 127.0.0.1, and the kernel keeps delivering loopback traffic to
// the more specific listener. The second server reports itself as started, receives nothing, and
// the browser that was meant to reach it talks to the first stack instead — including its
// database. That is the #276 defect.
//
// So the wildcard default is kept for the container path and refused for task-isolated stacks,
// where the bind address must be stated explicitly.

const WILDCARD_HOSTS = new Set([
  "",
  "*",
  "0.0.0.0",
  "::",
  "[::]",
  "::0",
  "0000:0000:0000:0000:0000:0000:0000:0000",
]);

export const DEFAULT_API_HOST = "0.0.0.0";
export const DEFAULT_API_PORT = 4000;

export interface ApiBinding {
  host: string;
  port: number;
}

export function isWildcardHost(host: string): boolean {
  return WILDCARD_HOSTS.has(host.trim().toLowerCase());
}

export function resolveApiBinding(environment: NodeJS.ProcessEnv): ApiBinding {
  const isTaskStack = environment.GLANTRI_DB_MODE === "task";
  const requestedHost = environment.API_HOST?.trim();
  const requestedPort = environment.API_PORT?.trim();

  if (isTaskStack) {
    if (!requestedHost) {
      throw new Error(
        "API_HOST must be set explicitly when GLANTRI_DB_MODE=task. Start the stack through `pnpm db:task:exec -- <command>`, which supplies this worktree's own loopback host and ports.",
      );
    }

    if (isWildcardHost(requestedHost)) {
      throw new Error(
        `API_HOST=${requestedHost} is a wildcard address and is refused for a task-isolated stack. A wildcard bind can succeed alongside another stack's loopback listener and silently lose the traffic to it. Bind an explicit loopback address instead.`,
      );
    }

    if (!requestedPort) {
      throw new Error(
        "API_PORT must be set explicitly when GLANTRI_DB_MODE=task. Start the stack through `pnpm db:task:exec -- <command>`, which supplies this worktree's own loopback host and ports.",
      );
    }
  }

  const host = requestedHost || DEFAULT_API_HOST;
  const port =
    requestedPort === undefined || requestedPort === "" ? DEFAULT_API_PORT : Number(requestedPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `API_PORT must be an integer between 1 and 65535; received "${requestedPort}".`,
    );
  }

  return { host, port };
}

export function describeListenFailure(binding: ApiBinding, error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;

  if (code === "EADDRINUSE") {
    return `Another process already holds ${binding.host}:${binding.port}. Refusing to start a second API on a port this process does not own; stop that process or start this stack on its own port.`;
  }

  return String(error);
}

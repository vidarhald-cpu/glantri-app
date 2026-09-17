import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

export const PLAYTEST = Object.freeze({
  apiUrl: "http://localhost:4000",
  container: "glantri-playtest-pg16",
  database: "glantri_playtest",
  databasePort: "5433",
  databaseVolume: "glantri_playtest_pg16_data",
  webUrl: "http://localhost:3000",
});

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultRepositoryRoot = resolve(scriptDirectory, "..", "..");
const serviceDefinitions = Object.freeze({
  api: {
    args: ["--filter", "@glantri/api", "dev"],
    port: 4000,
    readinessUrl: `${PLAYTEST.apiUrl}/ready`,
    signature: ["@glantri/api", "dev"],
  },
  web: {
    args: [
      "--filter",
      "@glantri/web",
      "exec",
      "next",
      "dev",
      "--hostname",
      "localhost",
      "--port",
      "3000",
    ],
    port: 3000,
    readinessUrl: PLAYTEST.webUrl,
    signature: ["@glantri/web", "next", "dev", "3000"],
  },
});

function fail(message) {
  throw new Error(message);
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function redact(text) {
  return String(text ?? "")
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, "$1<redacted>@")
    .replace(/(password\s*[=:]\s*)\S+/gi, "$1<redacted>");
}

function parseEnvironmentFile(path) {
  if (!existsSync(path)) {
    fail(`Playtest environment is missing: ${path}`);
  }

  const stats = statSync(path);

  if (!stats.isFile()) {
    fail(`Playtest environment must be a regular file: ${path}`);
  }

  if ((stats.mode & 0o077) !== 0) {
    fail(`Playtest environment must not be accessible to group or other users: ${path}`);
  }

  const environment = {};

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      fail(`Invalid environment entry in ${path}.`);
    }

    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      fail(`Invalid environment variable name in ${path}.`);
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    environment[name] = value;
  }

  return environment;
}

export function validatePlaytestEnvironment(environment) {
  for (const name of ["DATABASE_URL", "GLANTRI_LOCAL_SEED_EMAIL", "GLANTRI_LOCAL_SEED_PASSWORD"]) {
    if (!environment[name]?.trim()) {
      fail(`${name} is required in the external playtest environment.`);
    }
  }

  let databaseUrl;

  try {
    databaseUrl = new URL(environment.DATABASE_URL);
  } catch {
    fail("Playtest DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    fail("Playtest DATABASE_URL must use the postgresql:// protocol.");
  }

  const database = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
  const host = databaseUrl.hostname.toLowerCase().replace(/\.$/, "");
  const port = databaseUrl.port || "5432";

  if (
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) ||
    port !== PLAYTEST.databasePort ||
    database !== PLAYTEST.database
  ) {
    fail(
      `Playtest DATABASE_URL must target loopback port ${PLAYTEST.databasePort}/${PLAYTEST.database}.`,
    );
  }

  return { database, host, port };
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    const detail = redact(result.stderr || result.stdout).trim();
    fail(`${basename(command)} ${args.join(" ")} failed${detail ? `: ${detail}` : "."}`);
  }

  return {
    status: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function processInfo(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 1) {
    return null;
  }

  const fields = {};

  for (const [name, format] of [
    ["pgid", "pgid="],
    ["startedAt", "lstart="],
    ["command", "command="],
  ]) {
    const result = runCommand("ps", ["-p", String(pid), "-o", format], {
      allowFailure: true,
    });

    if (result.status !== 0 || !result.stdout.trim()) {
      return null;
    }

    fields[name] = result.stdout.trim();
  }

  const pgid = Number(fields.pgid);

  if (!Number.isSafeInteger(pgid)) {
    return null;
  }

  return {
    command: fields.command,
    pgid,
    startedAt: fields.startedAt,
  };
}

function listListeners(port) {
  const result = runCommand("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    allowFailure: true,
  });

  if (result.status !== 0 && !result.stdout.trim()) {
    return [];
  }

  return [
    ...new Set(
      result.stdout
        .split(/\s+/)
        .map((value) => Number(value))
        .filter((value) => Number.isSafeInteger(value) && value > 1),
    ),
  ];
}

async function httpGet(url) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(2_000),
    });
    const body = await response.text();
    return { body, status: response.status };
  } catch {
    return null;
  }
}

async function tcpReady(host, port) {
  return new Promise((resolveReady) => {
    const socket = net.createConnection({ host, port: Number(port) });
    const finish = (ready) => {
      socket.destroy();
      resolveReady(ready);
    };
    socket.setTimeout(1_000);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

function spawnManaged(command, args, options) {
  const logDescriptor = openSync(options.logPath, "a", 0o600);

  try {
    writeFileSync(
      logDescriptor,
      `\n=== ${new Date().toISOString()} starting ${options.service} ===\n`,
    );
    const child = spawn(command, args, {
      cwd: options.cwd,
      detached: true,
      env: options.env,
      stdio: ["ignore", logDescriptor, logDescriptor],
    });
    child.unref();
    return child.pid;
  } finally {
    closeSync(logDescriptor);
  }
}

const realSystem = {
  httpGet,
  listListeners,
  processInfo,
  runCommand,
  signalGroup(pid, signal) {
    process.kill(-pid, signal);
  },
  sleep: wait,
  spawnManaged,
  tcpReady,
};

function stateFile(stateDirectory, service) {
  return resolve(stateDirectory, `${service}.json`);
}

function logFile(stateDirectory, service) {
  return resolve(stateDirectory, `${service}.log`);
}

function readManifest(stateDirectory, service) {
  const path = stateFile(stateDirectory, service);

  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    fail(`Managed ${service} state is unreadable: ${path}`);
  }
}

function writeManifest(stateDirectory, service, manifest) {
  const path = stateFile(stateDirectory, service);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, path);
}

function validateManifest(manifest, service, repositoryRoot, system) {
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    manifest.service !== service ||
    manifest.repositoryRoot !== repositoryRoot ||
    !Number.isSafeInteger(manifest.pid) ||
    manifest.pid <= 1 ||
    typeof manifest.startedAt !== "string"
  ) {
    return { kind: "unsafe", reason: "recorded ownership is invalid" };
  }

  const info = system.processInfo(manifest.pid);

  if (!info) {
    return { kind: "stale", reason: "recorded process is no longer running" };
  }

  const definition = serviceDefinitions[service];
  const matchesSignature = definition.signature.every((part) => info.command.includes(part));

  if (info.pgid !== manifest.pid || info.startedAt !== manifest.startedAt || !matchesSignature) {
    return { kind: "unsafe", reason: "PID now belongs to a different process" };
  }

  return { info, kind: "owned" };
}

function listenerOwnership(listeners, managedPid, system) {
  if (listeners.length === 0) {
    return { kind: "none" };
  }

  const foreign = listeners.filter((pid) => system.processInfo(pid)?.pgid !== managedPid);
  return foreign.length > 0 ? { foreign, kind: "foreign" } : { kind: "owned" };
}

function inspectDatabase(system) {
  const status = system.runCommand(
    "docker",
    ["inspect", "--format", "{{.State.Status}}", PLAYTEST.container],
    { allowFailure: true },
  );

  if (status.status !== 0) {
    return {
      kind: "missing",
      reason: `container ${PLAYTEST.container} is missing; it will not be recreated automatically`,
    };
  }

  const mountsResult = system.runCommand(
    "docker",
    ["inspect", "--format", "{{json .Mounts}}", PLAYTEST.container],
    {},
  );
  const portsResult = system.runCommand(
    "docker",
    ["inspect", "--format", "{{json .HostConfig.PortBindings}}", PLAYTEST.container],
    {},
  );
  const volumeResult = system.runCommand(
    "docker",
    ["volume", "inspect", "--format", "{{.Driver}}", PLAYTEST.databaseVolume],
    { allowFailure: true },
  );

  if (volumeResult.status !== 0) {
    return {
      kind: "inconsistent",
      reason: `persistent volume ${PLAYTEST.databaseVolume} is missing`,
    };
  }

  let mounts;
  let ports;

  try {
    mounts = JSON.parse(mountsResult.stdout);
    ports = JSON.parse(portsResult.stdout);
  } catch {
    return { kind: "inconsistent", reason: "Docker returned unreadable container metadata" };
  }

  const dataMount = mounts.find(
    (mount) =>
      mount.Type === "volume" &&
      mount.Name === PLAYTEST.databaseVolume &&
      mount.Destination === "/var/lib/postgresql/data",
  );
  const bindings = ports?.["5432/tcp"];
  const validBinding =
    Array.isArray(bindings) &&
    bindings.length === 1 &&
    bindings[0]?.HostIp === "127.0.0.1" &&
    bindings[0]?.HostPort === PLAYTEST.databasePort;

  if (!dataMount || !validBinding || volumeResult.stdout.trim() !== "local") {
    return {
      kind: "inconsistent",
      reason: `container ${PLAYTEST.container} does not match the required volume and 127.0.0.1:${PLAYTEST.databasePort} binding`,
    };
  }

  return {
    kind: status.stdout.trim() === "running" ? "running" : "stopped",
    status: status.stdout.trim(),
  };
}

function runtimeEnvironment(baseEnvironment, playtestEnvironment, stateDirectory) {
  return {
    ...baseEnvironment,
    ARTIFACT_LOCAL_ROOT: resolve(stateDirectory, "artifacts"),
    ARTIFACT_STORAGE_PROVIDER: "local",
    DATABASE_URL: playtestEnvironment.DATABASE_URL,
    GLANTRI_DB_MODE: "playtest",
    NEXT_PUBLIC_API_BASE_URL: PLAYTEST.apiUrl,
    NODE_ENV: "development",
    API_HOST: "localhost",
    API_PORT: "4000",
    WEB_ORIGIN: PLAYTEST.webUrl,
  };
}

export function createPlaytestController(options = {}) {
  const repositoryRoot = realpathSync(options.repositoryRoot ?? defaultRepositoryRoot);
  const expectedRepositoryRoot = realpathSync(
    options.expectedRepositoryRoot ?? resolve(homedir(), "dev", "glantri-app-forgejo"),
  );
  const stateDirectory =
    options.stateDirectory ?? resolve(repositoryRoot, ".local-artifacts", "playtest");
  const environment = options.environment ?? process.env;
  const system = options.system ?? realSystem;
  const output = options.output ?? console;
  const pnpm = environment.GLANTRI_PLAYTEST_PNPM_BIN ?? "pnpm";
  const node = environment.GLANTRI_PLAYTEST_NODE_BIN ?? process.execPath;
  const environmentPath =
    environment.GLANTRI_PLAYTEST_ENV_FILE ??
    resolve(homedir(), "Glantri-Server", "playtest-db", ".env.playtest");

  function validatePrimaryCheckout() {
    if (repositoryRoot !== expectedRepositoryRoot) {
      fail(`Standing playtest controls must run from ${expectedRepositoryRoot}.`);
    }

    const gitPath = resolve(repositoryRoot, ".git");

    if (!existsSync(gitPath) || !lstatSync(gitPath).isDirectory()) {
      fail("Standing playtest controls are disabled in linked worktrees.");
    }
  }

  function readExternalEnvironment() {
    const configured = parseEnvironmentFile(environmentPath);
    validatePlaytestEnvironment(configured);
    return configured;
  }

  async function ensureDatabase() {
    let database = inspectDatabase(system);

    if (database.kind === "missing" || database.kind === "inconsistent") {
      fail(database.reason);
    }

    if (database.kind === "stopped") {
      output.log(`Starting existing persistent database container ${PLAYTEST.container}...`);
      system.runCommand("docker", ["start", PLAYTEST.container], {});

      for (let attempt = 0; attempt < 30; attempt += 1) {
        await system.sleep(1_000);
        database = inspectDatabase(system);
        if (database.kind === "running") {
          break;
        }
      }
    }

    if (database.kind !== "running") {
      fail(`Persistent database container ${PLAYTEST.container} did not start.`);
    }

    const version = system.runCommand(
      "docker",
      ["exec", PLAYTEST.container, "postgres", "--version"],
      {},
    );

    if (!/PostgreSQL\) 16\./.test(version.stdout)) {
      fail(`${PLAYTEST.container} is not running PostgreSQL 16.`);
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await system.tcpReady("127.0.0.1", PLAYTEST.databasePort)) {
        return;
      }
      await system.sleep(1_000);
    }

    fail(`Persistent database did not become reachable on 127.0.0.1:${PLAYTEST.databasePort}.`);
  }

  async function serviceStatus(service) {
    const definition = serviceDefinitions[service];
    const manifest = readManifest(stateDirectory, service);
    const listeners = system.listListeners(definition.port);

    if (!manifest) {
      return listeners.length > 0
        ? {
            detail: `foreign listener PID ${listeners.join(", ")} on port ${definition.port}`,
            kind: "foreign",
          }
        : { detail: "stopped", kind: "stopped" };
    }

    const ownership = validateManifest(manifest, service, repositoryRoot, system);

    if (ownership.kind !== "owned") {
      if (ownership.kind === "stale" && listeners.length > 0) {
        return {
          detail: `foreign listener PID ${listeners.join(", ")} on port ${definition.port} with stale managed state`,
          kind: "foreign",
          manifest,
        };
      }
      return { detail: ownership.reason, kind: ownership.kind, manifest };
    }

    const portOwnership = listenerOwnership(listeners, manifest.pid, system);

    if (portOwnership.kind === "foreign") {
      return {
        detail: `foreign listener PID ${portOwnership.foreign.join(", ")} shares port ${definition.port}`,
        kind: "foreign",
        manifest,
      };
    }

    const response = await system.httpGet(definition.readinessUrl);
    const ready =
      response &&
      (service === "api"
        ? response.status === 200 &&
          (() => {
            try {
              return JSON.parse(response.body).status === "ready";
            } catch {
              return false;
            }
          })()
        : response.status >= 200 && response.status < 400);

    return ready
      ? { detail: `ready (managed PID ${manifest.pid})`, kind: "ready", manifest }
      : { detail: `managed PID ${manifest.pid} is not ready`, kind: "managed-unready", manifest };
  }

  async function waitForReady(service, timeoutSeconds = 90) {
    for (let attempt = 0; attempt < timeoutSeconds; attempt += 1) {
      const status = await serviceStatus(service);

      if (status.kind === "ready") {
        return;
      }

      if (["foreign", "unsafe", "stale"].includes(status.kind)) {
        fail(`${service} startup ownership check failed: ${status.detail}`);
      }

      await system.sleep(1_000);
    }

    fail(`${service} did not become ready; inspect pnpm playtest:logs.`);
  }

  function startService(service, childEnvironment) {
    const definition = serviceDefinitions[service];
    const pid = system.spawnManaged(pnpm, definition.args, {
      cwd: repositoryRoot,
      env: childEnvironment,
      logPath: logFile(stateDirectory, service),
      service,
    });

    if (!Number.isSafeInteger(pid) || pid <= 1) {
      fail(`Unable to start managed ${service} process.`);
    }

    const info = system.processInfo(pid);

    if (!info || info.pgid !== pid) {
      fail(`Managed ${service} process did not establish an owned process group.`);
    }

    writeManifest(stateDirectory, service, {
      pid,
      repositoryRoot,
      schemaVersion: 1,
      service,
      startedAt: info.startedAt,
    });
  }

  async function stopService(service) {
    const manifest = readManifest(stateDirectory, service);

    if (!manifest) {
      return { detail: "already stopped", kind: "stopped" };
    }

    const ownership = validateManifest(manifest, service, repositoryRoot, system);

    if (ownership.kind === "stale") {
      unlinkSync(stateFile(stateDirectory, service));
      return { detail: "removed stale runtime state", kind: "stopped" };
    }

    if (ownership.kind !== "owned") {
      return { detail: ownership.reason, kind: "unsafe" };
    }

    system.signalGroup(manifest.pid, "SIGTERM");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await system.sleep(500);
      if (!system.processInfo(manifest.pid)) {
        unlinkSync(stateFile(stateDirectory, service));
        return { detail: `stopped managed PID ${manifest.pid}`, kind: "stopped" };
      }
    }

    const rechecked = validateManifest(manifest, service, repositoryRoot, system);

    if (rechecked.kind !== "owned") {
      return {
        detail: "ownership changed while stopping; refusing another signal",
        kind: "unsafe",
      };
    }

    system.signalGroup(manifest.pid, "SIGKILL");
    await system.sleep(250);

    if (system.processInfo(manifest.pid)) {
      return { detail: `managed PID ${manifest.pid} did not stop`, kind: "unsafe" };
    }

    unlinkSync(stateFile(stateDirectory, service));
    return { detail: `stopped managed PID ${manifest.pid}`, kind: "stopped" };
  }

  async function start() {
    validatePrimaryCheckout();
    mkdirSync(stateDirectory, { mode: 0o700, recursive: true });
    chmodSync(stateDirectory, 0o700);

    const before = await Promise.all([serviceStatus("api"), serviceStatus("web")]);

    if (before.every((status) => status.kind === "ready")) {
      const database = inspectDatabase(system);
      if (database.kind === "running") {
        output.log(`Glantri playtest is ready: ${PLAYTEST.webUrl}`);
        return;
      }
      fail(
        "Managed Web/API are running but the persistent database is not ready; use playtest:restart.",
      );
    }

    const active = before.filter((status) => status.kind !== "stopped" && status.kind !== "stale");

    if (active.length > 0) {
      fail(
        `Required ports or managed processes are already active (${active.map((status) => status.detail).join("; ")}). Stop the owning process or run pnpm playtest:restart for this runtime.`,
      );
    }

    for (const service of ["api", "web"]) {
      const stale = before[service === "api" ? 0 : 1];
      if (stale.kind === "stale") {
        unlinkSync(stateFile(stateDirectory, service));
      }
    }

    const configured = readExternalEnvironment();
    const childEnvironment = runtimeEnvironment(environment, configured, stateDirectory);
    mkdirSync(childEnvironment.ARTIFACT_LOCAL_ROOT, { mode: 0o700, recursive: true });

    await ensureDatabase();
    output.log("Generating the Prisma client...");
    system.runCommand(pnpm, ["--filter", "@glantri/database", "db:generate"], {
      cwd: repositoryRoot,
      env: childEnvironment,
      inherit: true,
    });
    output.log("Applying committed playtest migrations...");
    system.runCommand(
      node,
      [
        "--import",
        "tsx",
        resolve(repositoryRoot, "scripts/database/guardedDatabaseCommand.ts"),
        "playtest-deploy",
      ],
      { cwd: repositoryRoot, env: childEnvironment, inherit: true },
    );
    output.log("Building the Web and API runtime...");
    system.runCommand(pnpm, ["build"], {
      cwd: repositoryRoot,
      env: { ...childEnvironment, NODE_ENV: "production" },
      inherit: true,
    });

    try {
      output.log("Starting managed API...");
      startService("api", childEnvironment);
      await waitForReady("api");
      output.log("Starting managed Web...");
      startService("web", childEnvironment);
      await waitForReady("web");
    } catch (error) {
      await stopService("web");
      await stopService("api");
      throw error;
    }

    output.log(`Glantri playtest is ready: ${PLAYTEST.webUrl}`);
  }

  async function stop() {
    validatePrimaryCheckout();
    mkdirSync(stateDirectory, { mode: 0o700, recursive: true });
    const results = [];

    for (const service of ["web", "api"]) {
      const result = await stopService(service);
      results.push({ ...result, service });
      output.log(`${service === "web" ? "Web" : "API"}: ${result.detail}`);
    }

    output.log(
      `Database: left running and intact (${PLAYTEST.container}/${PLAYTEST.databaseVolume})`,
    );

    const unsafe = results.find((result) => result.kind === "unsafe");
    if (unsafe) {
      fail(`Refused to stop unverified ${unsafe.service} process: ${unsafe.detail}`);
    }
  }

  async function status() {
    validatePrimaryCheckout();
    const database = inspectDatabase(system);
    const api = await serviceStatus("api");
    const web = await serviceStatus("web");
    const databaseReady = database.kind === "running";
    const overallReady = databaseReady && api.kind === "ready" && web.kind === "ready";

    output.log(
      `Database: ${databaseReady ? "ready" : (database.reason ?? database.status ?? database.kind)}`,
    );
    output.log(`API: ${api.detail}`);
    output.log(`Web: ${web.detail}`);
    output.log(`Overall: ${overallReady ? "ready" : "not ready"}`);

    if (!overallReady) {
      process.exitCode = 1;
    }

    return { api, database, overallReady, web };
  }

  function logs() {
    validatePrimaryCheckout();
    mkdirSync(stateDirectory, { mode: 0o700, recursive: true });

    for (const service of ["api", "web"]) {
      const path = logFile(stateDirectory, service);
      output.log(`\n${service === "api" ? "API" : "Web"} log: ${path}`);

      if (!existsSync(path)) {
        output.log("(no log yet)");
        continue;
      }

      const lines = readFileSync(path, "utf8").split(/\r?\n/);
      output.log(lines.slice(-120).join("\n"));
    }
  }

  async function restart() {
    await stop();
    await start();
  }

  return { logs, restart, start, status, stop };
}

async function main() {
  const action = process.argv[2];

  if (!action || !["start", "stop", "restart", "status", "logs"].includes(action)) {
    fail("Expected one of: start, stop, restart, status, logs.");
  }

  const controller = createPlaytestController();
  await controller[action]();
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(
      `Playtest runtime failed: ${redact(error instanceof Error ? error.message : error)}`,
    );
    process.exitCode = 1;
  });
}

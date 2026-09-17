import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  PLAYTEST,
  createPlaytestController,
  validatePlaytestEnvironment,
} from "./runtimeController.mjs";

function createFixture() {
  const repositoryRoot = mkdtempSync(resolve(tmpdir(), "glantri-playtest-controller-"));
  const stateDirectory = resolve(repositoryRoot, ".local-artifacts", "playtest");
  const environmentPath = resolve(repositoryRoot, ".env.playtest");
  mkdirSync(resolve(repositoryRoot, ".git"));
  writeFileSync(
    environmentPath,
    [
      "DATABASE_URL=postgresql://postgres:private@127.0.0.1:5433/glantri_playtest",
      "GLANTRI_LOCAL_SEED_EMAIL=local-playtest-gm@example.invalid",
      "GLANTRI_LOCAL_SEED_PASSWORD=private-password",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  chmodSync(environmentPath, 0o600);
  return { environmentPath, repositoryRoot, stateDirectory };
}

function createFakeSystem(options = {}) {
  const calls = [];
  const listeners = new Map();
  const processes = new Map();
  const signals = [];
  let containerStatus = options.containerStatus ?? "running";
  let nextPid = 4100;

  if (options.foreignPort) {
    const pid = 9001;
    listeners.set(options.foreignPort, [pid]);
    processes.set(pid, {
      command: "foreign-server",
      pgid: pid,
      startedAt: "Thu Sep 17 10:00:00 2026",
    });
  }

  const system = {
    calls,
    httpGet(url) {
      const port = url.includes(":4000") ? 4000 : 3000;
      if (!listeners.get(port)?.length) return null;
      return Promise.resolve({
        body: port === 4000 ? JSON.stringify({ status: "ready" }) : "ready",
        status: 200,
      });
    },
    listListeners(port) {
      return listeners.get(port) ?? [];
    },
    processInfo(pid) {
      return processes.get(pid) ?? null;
    },
    runCommand(command, args, commandOptions = {}) {
      calls.push({ args, command, options: commandOptions });
      if (command === "docker" && args[0] === "inspect" && args[2] === "{{.State.Status}}") {
        return options.containerMissing
          ? { status: 1, stderr: "missing", stdout: "" }
          : { status: 0, stderr: "", stdout: `${containerStatus}\n` };
      }
      if (command === "docker" && args[0] === "inspect" && args[2] === "{{json .Mounts}}") {
        return {
          status: 0,
          stderr: "",
          stdout: JSON.stringify([
            {
              Destination: "/var/lib/postgresql/data",
              Name: PLAYTEST.databaseVolume,
              Type: "volume",
            },
          ]),
        };
      }
      if (
        command === "docker" &&
        args[0] === "inspect" &&
        args[2] === "{{json .HostConfig.PortBindings}}"
      ) {
        return {
          status: 0,
          stderr: "",
          stdout: JSON.stringify({
            "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: PLAYTEST.databasePort }],
          }),
        };
      }
      if (command === "docker" && args[0] === "volume") {
        return { status: 0, stderr: "", stdout: "local\n" };
      }
      if (command === "docker" && args[0] === "start") {
        containerStatus = "running";
        return { status: 0, stderr: "", stdout: `${PLAYTEST.container}\n` };
      }
      if (command === "docker" && args[0] === "exec") {
        return { status: 0, stderr: "", stdout: "postgres (PostgreSQL) 16.10\n" };
      }
      return { status: 0, stderr: "", stdout: "" };
    },
    signalGroup(pid, signal) {
      signals.push({ pid, signal });
      processes.delete(pid);
      for (const [port, pids] of listeners) {
        listeners.set(
          port,
          pids.filter((candidate) => candidate !== pid),
        );
      }
    },
    signals,
    sleep() {
      return Promise.resolve();
    },
    spawnManaged(command, args, spawnOptions) {
      calls.push({ args, command, options: spawnOptions, spawn: true });
      const pid = nextPid;
      nextPid += 100;
      const port = spawnOptions.service === "api" ? 4000 : 3000;
      processes.set(pid, {
        command: `${command} ${args.join(" ")}`,
        pgid: pid,
        startedAt: `Thu Sep 17 10:00:${pid === 4100 ? "01" : "02"} 2026`,
      });
      listeners.set(port, [pid]);
      return pid;
    },
    tcpReady() {
      return Promise.resolve(true);
    },
  };

  return system;
}

function createController(fixture, system, messages = []) {
  return createPlaytestController({
    environment: {
      GLANTRI_PLAYTEST_ENV_FILE: fixture.environmentPath,
      GLANTRI_PLAYTEST_NODE_BIN: "/fake/node",
      GLANTRI_PLAYTEST_PNPM_BIN: "/fake/pnpm",
    },
    expectedRepositoryRoot: fixture.repositoryRoot,
    output: { log: (message) => messages.push(String(message)) },
    repositoryRoot: fixture.repositoryRoot,
    stateDirectory: fixture.stateDirectory,
    system,
  });
}

test("start validates resources, deploys committed migrations, and starts one owned service pair", async () => {
  const fixture = createFixture();
  const system = createFakeSystem();
  const messages = [];
  const controller = createController(fixture, system, messages);

  await controller.start();

  const commands = system.calls.map(({ args, command }) => `${command} ${args.join(" ")}`);
  assert(commands.some((command) => command.includes("@glantri/database db:generate")));
  assert(commands.some((command) => command.includes("playtest-deploy")));
  assert(commands.some((command) => command === "/fake/pnpm build"));
  assert.equal(system.calls.filter((call) => call.spawn).length, 2);
  assert.equal(
    commands.some((command) =>
      /\b(reset|seed|migrate dev|docker run|docker create)\b/.test(command),
    ),
    false,
  );
  assert(messages.includes(`Glantri playtest is ready: ${PLAYTEST.webUrl}`));

  await controller.start();
  assert.equal(
    system.calls.filter((call) => call.spawn).length,
    2,
    "second start stays idempotent",
  );

  const status = await controller.status();
  assert.equal(status.overallReady, true);
});

test("start starts only the existing stopped database container", async () => {
  const fixture = createFixture();
  const system = createFakeSystem({ containerStatus: "exited" });
  const controller = createController(fixture, system);

  await controller.start();

  assert(
    system.calls.some(
      ({ args, command }) =>
        command === "docker" && args.join(" ") === `start ${PLAYTEST.container}`,
    ),
  );
  assert.equal(
    system.calls.some(
      ({ args, command }) => command === "docker" && ["run", "create", "rm"].includes(args[0]),
    ),
    false,
  );
});

test("start fails closed when the persistent container is missing", async () => {
  const fixture = createFixture();
  const system = createFakeSystem({ containerMissing: true });
  const controller = createController(fixture, system);

  await assert.rejects(controller.start(), /will not be recreated automatically/);
  assert.equal(system.calls.filter((call) => call.spawn).length, 0);
  assert.equal(
    system.calls.some(
      ({ args, command }) => command === "docker" && ["run", "create"].includes(args[0]),
    ),
    false,
  );
});

test("start refuses a foreign listener before build or process mutation", async () => {
  const fixture = createFixture();
  const system = createFakeSystem({ foreignPort: 4000 });
  const controller = createController(fixture, system);

  await assert.rejects(controller.start(), /foreign listener PID 9001/);
  assert.equal(system.calls.filter((call) => call.spawn).length, 0);
  assert.equal(
    system.calls.some(({ command }) => command === "/fake/pnpm"),
    false,
  );
});

test("stop signals only a process matching the recorded ownership fingerprint", async () => {
  const fixture = createFixture();
  mkdirSync(fixture.stateDirectory, { recursive: true });
  writeFileSync(
    resolve(fixture.stateDirectory, "api.json"),
    JSON.stringify({
      pid: 7777,
      repositoryRoot: fixture.repositoryRoot,
      schemaVersion: 1,
      service: "api",
      startedAt: "Thu Sep 17 10:00:00 2026",
    }),
  );
  const system = createFakeSystem();
  system.processInfo = (pid) =>
    pid === 7777
      ? {
          command: "unrelated-process",
          pgid: 7777,
          startedAt: "Thu Sep 17 10:00:00 2026",
        }
      : null;
  const controller = createController(fixture, system);

  await assert.rejects(controller.stop(), /Refused to stop unverified api process/);
  assert.deepEqual(system.signals, []);
});

test("stop terminates only owned Web/API groups and leaves Docker untouched", async () => {
  const fixture = createFixture();
  const system = createFakeSystem();
  const controller = createController(fixture, system);

  await controller.start();
  await controller.stop();

  assert.deepEqual(system.signals, [
    { pid: 4200, signal: "SIGTERM" },
    { pid: 4100, signal: "SIGTERM" },
  ]);
  assert.equal(
    system.calls.some(
      ({ args, command }) =>
        command === "docker" && ["stop", "rm", "run", "create"].includes(args[0]),
    ),
    false,
  );

  await controller.start();
  assert.equal(system.calls.filter((call) => call.spawn).length, 4);
});

test("playtest target validation rejects shared and non-loopback databases", () => {
  const base = {
    GLANTRI_LOCAL_SEED_EMAIL: "local-playtest-gm@example.invalid",
    GLANTRI_LOCAL_SEED_PASSWORD: "private-password",
  };

  assert.throws(
    () =>
      validatePlaytestEnvironment({
        ...base,
        DATABASE_URL: "postgresql://postgres:x@localhost:5432/glantri",
      }),
    /must target loopback port 5433\/glantri_playtest/,
  );
  assert.throws(
    () =>
      validatePlaytestEnvironment({
        ...base,
        DATABASE_URL: "postgresql://postgres:x@db.example.com:5433/glantri_playtest",
      }),
    /must target loopback port/,
  );
});

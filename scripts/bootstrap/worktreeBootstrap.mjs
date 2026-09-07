import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROLE_USERNAMES = Object.freeze({
  builder: "glantri-builder",
  qa: "glantri-qa",
});

export const EXPECTED_ORIGIN = "http://127.0.0.1:3001/recovery-admin/glantri-app.git";

export const DATABASE_ENVIRONMENT_KEYS = Object.freeze([
  "DATABASE_URL",
  "DATABASE_URL_TEST",
  "GLANTRI_DB_APPLICATION_URL",
  "GLANTRI_DB_CONTAINER",
  "GLANTRI_DB_MODE",
  "GLANTRI_DB_OWNER",
  "GLANTRI_DB_TASK",
]);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, "..", "..");

function fail(message) {
  throw new Error(message);
}

export function parsePackageManager(value) {
  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(value ?? "");

  if (!match) {
    fail(`packageManager must pin an exact pnpm version; received ${value ?? "missing"}.`);
  }

  return match[1];
}

export function parseOptions(argv) {
  const separator = argv.indexOf("--");
  const optionArguments = separator >= 0 ? argv.slice(0, separator) : argv;
  const command = separator >= 0 ? argv.slice(separator + 1) : [];
  const options = {
    baseline: undefined,
    command,
    role: undefined,
    runOnly: false,
    selectedNode: undefined,
    skipDatabase: false,
    task: undefined,
  };

  for (let index = 0; index < optionArguments.length; index += 1) {
    const argument = optionArguments[index];

    if (argument === "--skip-database") {
      options.skipDatabase = true;
    } else if (argument === "--run") {
      options.runOnly = true;
      options.command = optionArguments.slice(index + 1);
      break;
    } else if (["--baseline", "--role", "--selected-node", "--task"].includes(argument)) {
      const value = optionArguments[index + 1];

      if (!value) {
        fail(`${argument} requires a value.`);
      }

      options[argument.slice(2).replace("selected-node", "selectedNode")] = value;
      index += 1;
    } else {
      fail(`Unknown bootstrap argument: ${argument}`);
    }
  }

  if (!options.selectedNode) {
    fail("--selected-node is required from the shell runtime selector.");
  }

  if (options.runOnly) {
    if (options.command.length === 0) {
      fail("worktree-runtime.sh requires a command to run.");
    }
    return options;
  }

  if (!ROLE_USERNAMES[options.role]) {
    fail("--role must be builder or qa so Forgejo never receives an unqualified probe.");
  }

  if (!options.task || !/^[A-Za-z0-9-]+$/.test(options.task)) {
    fail("--task is required and may contain only letters, numbers, and hyphens.");
  }

  if (!options.baseline || !/^[0-9a-f]{40}$/.test(options.baseline)) {
    fail("--baseline must be the exact 40-character accepted dev SHA from the task contract.");
  }

  return options;
}

export function requiredVersions(root = repositoryRoot) {
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

  return {
    node: readFileSync(resolve(root, ".node-version"), "utf8").trim(),
    pnpm: parsePackageManager(packageJson.packageManager),
  };
}

export function assertSelectedNode(selectedNode, requiredNode, current = process) {
  const selectedRealPath = realpathSync(selectedNode);
  const currentRealPath = realpathSync(current.execPath);

  if (current.versions.node !== requiredNode) {
    fail(`Bootstrap requires Node ${requiredNode}; selected runtime is ${current.versions.node}.`);
  }

  if (selectedRealPath !== currentRealPath) {
    fail(
      `Bootstrap process ${currentRealPath} differs from selected runtime ${selectedRealPath}; refusing mixed runtimes.`,
    );
  }
}

export function defaultCacheRoot(environment = process.env) {
  if (environment.GLANTRI_BOOTSTRAP_CACHE_ROOT) {
    if (!isAbsolute(environment.GLANTRI_BOOTSTRAP_CACHE_ROOT)) {
      fail("GLANTRI_BOOTSTRAP_CACHE_ROOT must be an absolute path.");
    }

    return resolve(environment.GLANTRI_BOOTSTRAP_CACHE_ROOT);
  }

  if (platform() === "darwin") {
    return resolve(homedir(), "Library", "Caches", "glantri-worktree-bootstrap");
  }

  return resolve(
    environment.XDG_CACHE_HOME || resolve(homedir(), ".cache"),
    "glantri-worktree-bootstrap",
  );
}

export function runtimeEnvironment(root, cacheRoot, inherited = process.env) {
  const runtimeBin = resolve(root, ".local-artifacts", "bootstrap", "bin");

  return {
    ...inherited,
    COREPACK_HOME: resolve(cacheRoot, "corepack"),
    npm_config_cache: resolve(cacheRoot, "npm-cache"),
    PATH: `${runtimeBin}:${inherited.PATH ?? ""}`,
    PNPM_HOME: runtimeBin,
  };
}

export function assertLinkedWorktree(root = repositoryRoot) {
  const gitMarker = resolve(root, ".git");

  if (!existsSync(gitMarker) || !lstatSync(gitMarker).isFile()) {
    fail("Deterministic task bootstrap is supported only in a linked Builder or QA worktree.");
  }
}

export function assertDatabasePreflight(root = repositoryRoot, environment = process.env) {
  for (const path of [resolve(root, ".env"), resolve(root, "packages", "database", ".env")]) {
    if (existsSync(path)) {
      fail(
        `Refusing bootstrap because linked worktree contains ${path}; never copy a primary checkout .env.`,
      );
    }
  }

  const inherited = DATABASE_ENVIRONMENT_KEYS.filter((name) => Boolean(environment[name]));

  if (inherited.length > 0) {
    fail(
      `Refusing database setup with inherited ${inherited.join(
        ", ",
      )}; clear them so current-worktree ownership is the only target authority.`,
    );
  }
}

function run(command, args, { capture = false, cwd = repositoryRoot, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
    stdio: capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = capture ? (result.stderr || result.stdout || "").trim() : "";
    fail(detail || `${command} exited with status ${result.status ?? 1}.`);
  }

  return capture ? result.stdout.trim() : "";
}

async function timed(timings, name, action) {
  const started = Date.now();

  try {
    return await action();
  } finally {
    const seconds = Math.max(0.1, (Date.now() - started) / 1000).toFixed(1);
    timings[name] = `${seconds}s`;
    console.log(`Bootstrap timing: ${name}=${timings[name]}`);
  }
}

function corepackPath(selectedNode) {
  const nodeDirectory = dirname(realpathSync(selectedNode));
  const path = resolve(
    nodeDirectory,
    "..",
    "lib",
    "node_modules",
    "corepack",
    "dist",
    "corepack.js",
  );

  if (!existsSync(path)) {
    fail(
      `Selected Node runtime has no bundled Corepack at ${path}; install the complete Node ${process.versions.node} distribution.`,
    );
  }

  return path;
}

function prepareRuntimeBin(root, selectedNode, corepack, environment) {
  const runtimeBin = resolve(root, ".local-artifacts", "bootstrap", "bin");
  mkdirSync(runtimeBin, { recursive: true });

  for (const name of ["node", "pnpm", "pnpx", "yarn", "yarnpkg"]) {
    rmSync(resolve(runtimeBin, name), { force: true });
  }

  symlinkSync(realpathSync(selectedNode), resolve(runtimeBin, "node"));
  run(selectedNode, [corepack, "enable", "--install-directory", runtimeBin], { env: environment });
  return runtimeBin;
}

function parseJsonOutput(command, args, environment) {
  return JSON.parse(run(command, args, { capture: true, env: environment }));
}

function verifyRuntime(root, versions, environment) {
  const runtimeBin = resolve(root, ".local-artifacts", "bootstrap", "bin");
  const nodeProbe = parseJsonOutput(
    resolve(runtimeBin, "node"),
    ["-p", "JSON.stringify({execPath:process.execPath,node:process.versions.node})"],
    environment,
  );
  const pnpmVersion = run(resolve(runtimeBin, "pnpm"), ["--version"], {
    capture: true,
    env: environment,
  });
  const pnpmUserAgent = run(resolve(runtimeBin, "pnpm"), ["config", "get", "user-agent"], {
    capture: true,
    env: environment,
  });

  if (
    nodeProbe.node !== versions.node ||
    realpathSync(nodeProbe.execPath) !== realpathSync(process.execPath)
  ) {
    fail("Generated Node shim does not resolve to the selected bootstrap runtime.");
  }

  if (pnpmVersion !== versions.pnpm || !pnpmUserAgent.includes(`node/v${versions.node}`)) {
    fail(
      `Corepack runtime mismatch: expected pnpm ${versions.pnpm} on Node ${versions.node}; received pnpm ${pnpmVersion} (${pnpmUserAgent}).`,
    );
  }

  return { nodeProbe, pnpmUserAgent, pnpmVersion };
}

function verifyBaseline(options, environment) {
  const username = ROLE_USERNAMES[options.role];
  const gitEnvironment = { ...environment, GIT_TERMINAL_PROMPT: "0" };
  const origin = run("git", ["remote", "get-url", "origin"], {
    capture: true,
    env: gitEnvironment,
  });

  if (origin !== EXPECTED_ORIGIN) {
    fail("origin is not the canonical loopback-only Forgejo repository; refusing credential use.");
  }

  run("git", ["-c", `credential.username=${username}`, "fetch", "origin", "dev"], {
    env: gitEnvironment,
  });

  const liveDev = run("git", ["rev-parse", "FETCH_HEAD^{commit}"], {
    capture: true,
    env: gitEnvironment,
  });

  if (liveDev !== options.baseline) {
    fail(
      `Live origin/dev ${liveDev} differs from accepted baseline ${options.baseline}; refresh the task contract.`,
    );
  }

  run("git", ["merge-base", "--is-ancestor", options.baseline, "HEAD"], { env: gitEnvironment });
  return { liveDev, username };
}

function writeManifest(root, values) {
  const path = resolve(root, ".local-artifacts", "bootstrap", "manifest.json");
  writeFileSync(path, `${JSON.stringify(values, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function readManifest(root) {
  const path = resolve(root, ".local-artifacts", "bootstrap", "manifest.json");

  if (!existsSync(path)) {
    fail("Bootstrap manifest is missing; run scripts/bootstrap-worktree.sh first.");
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

async function bootstrap(options) {
  const timings = {};
  const versions = requiredVersions();
  assertSelectedNode(options.selectedNode, versions.node);
  assertLinkedWorktree();
  assertDatabasePreflight();

  const cacheRoot = defaultCacheRoot();
  mkdirSync(cacheRoot, { recursive: true });
  const environment = runtimeEnvironment(repositoryRoot, cacheRoot);
  const corepack = corepackPath(options.selectedNode);

  await timed(timings, "runtime", () => {
    prepareRuntimeBin(repositoryRoot, options.selectedNode, corepack, environment);
    verifyRuntime(repositoryRoot, versions, environment);
  });

  const baseline = await timed(timings, "forgejo-baseline", () =>
    verifyBaseline(options, environment),
  );
  const pnpm = resolve(repositoryRoot, ".local-artifacts", "bootstrap", "bin", "pnpm");

  await timed(timings, "dependencies", () =>
    run(
      pnpm,
      [
        "install",
        "--frozen-lockfile",
        `--store-dir=${resolve(cacheRoot, "pnpm-store")}`,
        `--cache-dir=${resolve(cacheRoot, "pnpm-cache")}`,
      ],
      { env: environment },
    ),
  );

  await timed(timings, "prisma-client", () =>
    run(pnpm, ["--filter", "@glantri/database", "db:generate"], { env: environment }),
  );
  verifyRuntime(repositoryRoot, versions, environment);

  let database = "skipped by explicit --skip-database";
  if (!options.skipDatabase) {
    await timed(timings, "database", () => {
      run(pnpm, ["db:task:setup", "--", "--task", options.task], { env: environment });
      run(pnpm, ["db:task:verify"], { env: environment });
    });
    database = "owned disposable PostgreSQL 16 application and test databases verified";
  }

  const manifest = {
    baseline: baseline.liveDev,
    cacheRoot,
    database,
    node: versions.node,
    nodeExecutable: realpathSync(options.selectedNode),
    pnpm: versions.pnpm,
    role: options.role,
    task: options.task,
    timings,
  };
  writeManifest(repositoryRoot, manifest);

  console.log(
    `Bootstrap complete: role=${options.role} credential=${baseline.username} baseline=${baseline.liveDev} node=${versions.node} pnpm=${versions.pnpm}.`,
  );
  console.log(`Shared package cache: ${cacheRoot}`);

  if (options.command.length > 0) {
    run(options.command[0], options.command.slice(1), { env: environment });
  }
}

function runWithBootstrapRuntime(options) {
  const versions = requiredVersions();
  assertSelectedNode(options.selectedNode, versions.node);
  assertLinkedWorktree();
  const manifest = readManifest(repositoryRoot);
  const cacheRoot = resolve(manifest.cacheRoot);
  const environment = runtimeEnvironment(repositoryRoot, cacheRoot);
  const runtime = verifyRuntime(repositoryRoot, versions, environment);

  if (manifest.node !== versions.node || manifest.pnpm !== versions.pnpm) {
    fail("Bootstrap manifest no longer matches repository runtime pins; rerun bootstrap.");
  }

  if (!runtime.pnpmUserAgent.includes(`node/v${versions.node}`)) {
    fail("pnpm is not running under the selected worktree Node runtime.");
  }

  run(options.command[0], options.command.slice(1), { env: environment });
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);

  if (options.runOnly) {
    runWithBootstrapRuntime(options);
  } else {
    await bootstrap(options);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`Bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

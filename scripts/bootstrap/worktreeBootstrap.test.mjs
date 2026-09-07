import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  assertDatabasePreflight,
  defaultCacheRoot,
  parseOptions,
  parsePackageManager,
  runtimeEnvironment,
} from "./worktreeBootstrap.mjs";

test("requires an explicit Forgejo role, task, and immutable baseline", () => {
  assert.throws(
    () => parseOptions(["--selected-node", process.execPath]),
    /--role must be builder or qa/,
  );
  assert.throws(
    () =>
      parseOptions([
        "--selected-node",
        process.execPath,
        "--role",
        "builder",
        "--task",
        "55",
        "--baseline",
        "dev",
      ]),
    /exact 40-character accepted dev SHA/,
  );
});

test("pins package manager versions exactly", () => {
  assert.equal(parsePackageManager("pnpm@10.6.0"), "10.6.0");
  assert.throws(() => parsePackageManager("pnpm@^10.6.0"), /pin an exact pnpm version/);
});

test("puts the generated runtime shims before a hostile host PATH", () => {
  const environment = runtimeEnvironment("/tmp/glantri-test", "/tmp/glantri-cache", {
    PATH: "/opt/homebrew/bin:/usr/bin",
  });

  assert.equal(
    environment.PATH,
    "/tmp/glantri-test/.local-artifacts/bootstrap/bin:/opt/homebrew/bin:/usr/bin",
  );
  assert.equal(environment.COREPACK_HOME, "/tmp/glantri-cache/corepack");
  assert.equal(environment.PNPM_HOME, "/tmp/glantri-test/.local-artifacts/bootstrap/bin");
});

test("requires an explicit cache override to be absolute", () => {
  assert.throws(
    () => defaultCacheRoot({ GLANTRI_BOOTSTRAP_CACHE_ROOT: "relative-cache" }),
    /must be an absolute path/,
  );
});

test("fails closed before database setup when target authority is inherited or copied", () => {
  const root = mkdtempSync(resolve(tmpdir(), "glantri-bootstrap-db-"));
  mkdirSync(resolve(root, "packages", "database"), { recursive: true });

  try {
    assert.throws(
      () => assertDatabasePreflight(root, { DATABASE_URL: "postgresql://x" }),
      /inherited DATABASE_URL/,
    );
    writeFileSync(resolve(root, ".env"), "DATABASE_URL=secret\n");
    assert.throws(() => assertDatabasePreflight(root, {}), /never copy a primary checkout .env/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("an explicit incompatible Node override is refused without host fallback", () => {
  const root = mkdtempSync(resolve(tmpdir(), "glantri-bootstrap-node-"));
  const fakeNode = resolve(root, "node");
  writeFileSync(fakeNode, "#!/bin/sh\nprintf '25.8.2\\n'\n");
  chmodSync(fakeNode, 0o755);

  try {
    const result = spawnSync(
      "sh",
      [
        "-c",
        '. "$1/scripts/bootstrap/select-node.sh"; glantri_select_node "$1"',
        "sh",
        resolve(import.meta.dirname, "..", ".."),
      ],
      {
        encoding: "utf8",
        env: { ...process.env, GLANTRI_NODE_BIN: fakeNode },
      },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /refusing fallback/);
    assert.doesNotMatch(result.stdout, /homebrew/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

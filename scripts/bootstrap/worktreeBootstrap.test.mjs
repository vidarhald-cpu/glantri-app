import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  assertCanonicalOrigin,
  assertDatabasePreflight,
  DEFAULT_FORGEJO_ORIGIN,
  defaultCacheRoot,
  parseOptions,
  parsePackageManager,
  resolveExpectedOrigin,
  runtimeEnvironment,
} from "./worktreeBootstrap.mjs";

const MACBOOK_ORIGIN = "http://127.0.0.1:3001/recovery-admin/glantri-app.git";
const MAC_STUDIO_ORIGIN = "http://192.168.1.66:3001/recovery-admin/glantri-app.git";

const REFUSED_CONFIGURED_ORIGINS = [
  "",
  " ",
  "\t",
  "\n",
  `${MAC_STUDIO_ORIGIN}\n`,
  `${MAC_STUDIO_ORIGIN} `,
  `${MAC_STUDIO_ORIGIN}/`,
  `${MAC_STUDIO_ORIGIN};id`,
  `${MAC_STUDIO_ORIGIN}?token=x`,
  `${MAC_STUDIO_ORIGIN}#x`,
  `${MAC_STUDIO_ORIGIN}"`,
  "http://`id`:3001/recovery-admin/glantri-app.git",
  "http://$(hostname):3001/recovery-admin/glantri-app.git",
  "http://192.168.1.66:0/recovery-admin/glantri-app.git",
  "http://192.168.1.66:99999/recovery-admin/glantri-app.git",
  "http://192.168.1.66:3001/recovery-admin/glantri-app",
  "http://192.168.1.66:3001/recovery-admin/other-app.git",
  "http://192.168.1.66:3001/other-owner/glantri-app.git",
  "http://192.168.1.66:3001/recovery-admin/glantri-app.git/extra",
  "http://user:hunter2@192.168.1.66:3001/recovery-admin/glantri-app.git",
  "http://deploy@192.168.1.66:3001/recovery-admin/glantri-app.git",
  "ssh://192.168.1.66/recovery-admin/glantri-app.git",
  "ssh://git@192.168.1.66:22/recovery-admin/glantri-app.git",
  "git@192.168.1.66:recovery-admin/glantri-app.git",
  "file:///Users/vidarhald/dev/glantri-app-forgejo",
  "192.168.1.66:3001/recovery-admin/glantri-app.git",
];

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

test("the unconfigured expected origin is today's literal and admits an unchanged MacBook clone", () => {
  assert.equal(DEFAULT_FORGEJO_ORIGIN, MACBOOK_ORIGIN);
  assert.equal(resolveExpectedOrigin({}), MACBOOK_ORIGIN);
  assert.equal(assertCanonicalOrigin(MACBOOK_ORIGIN, resolveExpectedOrigin({})), MACBOOK_ORIGIN);
  // The default must itself satisfy the validation rule, so the two cannot drift apart.
  assert.equal(
    resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: DEFAULT_FORGEJO_ORIGIN }),
    MACBOOK_ORIGIN,
  );
});

test("a configured Mac Studio origin admits a Mac Studio clone", () => {
  const expected = resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: MAC_STUDIO_ORIGIN });

  assert.equal(expected, MAC_STUDIO_ORIGIN);
  assert.equal(assertCanonicalOrigin(MAC_STUDIO_ORIGIN, expected), MAC_STUDIO_ORIGIN);
});

test("only the host and port move: https, a hostname, and an omitted port are admitted", () => {
  for (const origin of [
    "https://192.168.1.66:3001/recovery-admin/glantri-app.git",
    "http://mac-studio.local:3001/recovery-admin/glantri-app.git",
    "http://forgejo/recovery-admin/glantri-app.git",
    "https://forgejo.example.com/recovery-admin/glantri-app.git",
  ]) {
    assert.equal(resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: origin }), origin);
  }
});

test("a Mac Studio clone still refuses while nothing is configured", () => {
  assert.throws(
    () => assertCanonicalOrigin(MAC_STUDIO_ORIGIN, resolveExpectedOrigin({})),
    (error) => {
      assert.match(error.message, /refusing credential use/);
      assert.match(error.message, /observed: "http:\/\/192\.168\.1\.66:3001/);
      assert.match(error.message, /expected: "http:\/\/127\.0\.0\.1:3001/);
      // The canonical repository is no longer loopback-only, so the refusal must not say it is.
      assert.doesNotMatch(error.message, /loopback/i);
      return true;
    },
  );
});

test("a different host refuses while the configured origin names another one", () => {
  const expected = resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: MAC_STUDIO_ORIGIN });

  for (const observed of [
    "https://github.com/recovery-admin/glantri-app.git",
    "https://codeberg.org/recovery-admin/glantri-app.git",
    MACBOOK_ORIGIN,
    "http://192.168.1.67:3001/recovery-admin/glantri-app.git",
    "http://192.168.1.66:3002/recovery-admin/glantri-app.git",
    "https://192.168.1.66:3001/recovery-admin/glantri-app.git",
  ]) {
    assert.throws(
      () => assertCanonicalOrigin(observed, expected),
      /refusing credential use/,
      `expected ${observed} to be refused`,
    );
  }
});

test("a configured origin carrying userinfo is refused, never redacted into use", () => {
  for (const configured of [
    "http://user:hunter2@192.168.1.66:3001/recovery-admin/glantri-app.git",
    "https://deploy@192.168.1.66:3001/recovery-admin/glantri-app.git",
    "git@192.168.1.66:recovery-admin/glantri-app.git",
  ]) {
    assert.throws(
      () => resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: configured }),
      (error) => {
        assert.match(error.message, /carries a userinfo component/);
        assert.match(error.message, /\*\*\*@/);
        assert.doesNotMatch(error.message, /hunter2/);
        assert.doesNotMatch(error.message, /user:/);
        assert.doesNotMatch(error.message, /deploy/);
        return true;
      },
      `expected ${configured} to be refused`,
    );
  }
});

test("an observed origin carrying userinfo is refused with the credential redacted", () => {
  assert.throws(
    () =>
      assertCanonicalOrigin(
        "http://glantri-builder:hunter2@192.168.1.66:3001/recovery-admin/glantri-app.git",
        resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: MAC_STUDIO_ORIGIN }),
      ),
    (error) => {
      assert.match(error.message, /refusing credential use/);
      assert.match(error.message, /observed: "http:\/\/\*\*\*@192\.168\.1\.66:3001/);
      assert.doesNotMatch(error.message, /hunter2/);
      assert.doesNotMatch(error.message, /glantri-builder/);
      return true;
    },
  );
});

test("the repository path stays pinned: another repository or a missing .git is refused", () => {
  for (const configured of [
    "http://192.168.1.66:3001/recovery-admin/glantri-app",
    "http://192.168.1.66:3001/recovery-admin/other-app.git",
    "http://192.168.1.66:3001/other-owner/glantri-app.git",
    "http://192.168.1.66:3001/recovery-admin/glantri-app.git/extra",
    "http://192.168.1.66:3001/",
    "http://192.168.1.66:3001",
  ]) {
    assert.throws(
      () => resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: configured }),
      /must be an http or https URL/,
      `expected ${configured} to be refused`,
    );
  }
});

test("a trailing slash is refused when configured and reported when only observed", () => {
  assert.throws(
    () => resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: `${MAC_STUDIO_ORIGIN}/` }),
    /must be an http or https URL/,
  );

  assert.throws(
    () =>
      assertCanonicalOrigin(
        `${MAC_STUDIO_ORIGIN}/`,
        resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: MAC_STUDIO_ORIGIN }),
      ),
    (error) => {
      assert.match(
        error.message,
        /observed: "http:\/\/192\.168\.1\.66:3001\/recovery-admin\/glantri-app\.git\/"/,
      );
      assert.match(
        error.message,
        /expected: "http:\/\/192\.168\.1\.66:3001\/recovery-admin\/glantri-app\.git"/,
      );
      return true;
    },
  );
});

test("ssh and scp-like remote forms are refused", () => {
  assert.throws(
    () =>
      resolveExpectedOrigin({
        GLANTRI_FORGEJO_ORIGIN: "ssh://192.168.1.66/recovery-admin/glantri-app.git",
      }),
    /must be an http or https URL/,
  );
  assert.throws(
    () =>
      resolveExpectedOrigin({
        GLANTRI_FORGEJO_ORIGIN: "ssh://git@192.168.1.66:22/recovery-admin/glantri-app.git",
      }),
    /carries a userinfo component/,
  );
  assert.throws(
    () =>
      assertCanonicalOrigin(
        "git@192.168.1.66:recovery-admin/glantri-app.git",
        resolveExpectedOrigin({}),
      ),
    /refusing credential use/,
  );
});

test("an empty, whitespace-only, or injection-shaped configured value is refused", () => {
  for (const configured of [
    "",
    " ",
    "\t",
    "\n",
    `${MAC_STUDIO_ORIGIN}\n`,
    `${MAC_STUDIO_ORIGIN} `,
    `${MAC_STUDIO_ORIGIN};id`,
    `${MAC_STUDIO_ORIGIN}"`,
    `${MAC_STUDIO_ORIGIN}?token=x`,
    `${MAC_STUDIO_ORIGIN}#x`,
    "http://`id`:3001/recovery-admin/glantri-app.git",
    "http://$(hostname):3001/recovery-admin/glantri-app.git",
    "http://192.168.1.66:0/recovery-admin/glantri-app.git",
    "http://192.168.1.66:99999/recovery-admin/glantri-app.git",
  ]) {
    assert.throws(
      () => resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: configured }),
      /must be an http or https URL/,
      `expected ${JSON.stringify(configured)} to be refused`,
    );
  }
});

test("a refused configured origin never resolves to the default", () => {
  for (const configured of REFUSED_CONFIGURED_ORIGINS) {
    let resolved = "NOT ASSIGNED";

    assert.throws(
      () => {
        resolved = resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: configured });
      },
      /falling back to the default origin/,
      `expected ${JSON.stringify(configured)} to be refused`,
    );

    assert.equal(
      resolved,
      "NOT ASSIGNED",
      `refusing ${JSON.stringify(configured)} must produce no expected origin at all`,
    );
    assert.throws(
      () =>
        assertCanonicalOrigin(
          DEFAULT_FORGEJO_ORIGIN,
          resolveExpectedOrigin({ GLANTRI_FORGEJO_ORIGIN: configured }),
        ),
      /falling back to the default origin/,
      `a clone whose origin is the default must still be refused while ${JSON.stringify(configured)} is configured`,
    );
  }
});

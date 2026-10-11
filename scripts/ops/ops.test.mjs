import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const diskGuard = path.join(here, "disk-guard.sh");
const dindCache = path.join(here, "dind-cache.sh");
const releaseWorktree = path.join(here, "release-worktree.sh");

const run = (file, args, env = {}) =>
  spawnSync("bash", [file, ...args], { encoding: "utf8", env: { ...process.env, ...env } });

test("disk-guard: exact threshold boundaries", () => {
  const cases = [
    [673, 0, "OK"],
    [100, 0, "OK"],
    [99, 10, "WARN"],
    [60, 10, "WARN"],
    [59, 20, "HOLD"],
    [40, 20, "HOLD"],
    [39, 30, "STOP"],
    [0, 30, "STOP"],
  ];
  for (const [gib, code, level] of cases) {
    const result = run(diskGuard, ["--free-gib", String(gib)]);
    assert.equal(result.status, code, `${gib} GiB`);
    assert.match(result.stdout, new RegExp(`level=${level} `));
  }
});

test("disk-guard: rejects bad input and a real measurement works", () => {
  assert.equal(run(diskGuard, ["--free-gib", "abc"]).status, 2);
  assert.equal(run(diskGuard, ["--bogus"]).status, 2);
  assert.equal(run(diskGuard, ["--path", "/nonexistent-path-for-557"]).status, 2);
  assert.ok([0, 10, 20, 30].includes(run(diskGuard, ["--path", tmpdir()]).status));
});

function fakeDocker({
  mounts = "glantri-forgejo-actions-docker-data /var/lib/docker\n",
  running = "",
  cacheLine,
}) {
  const dir = mkdtempSync(path.join(tmpdir(), "fake-docker-"));
  const log = path.join(dir, "argv.log");
  const bin = path.join(dir, "docker");
  writeFileSync(
    bin,
    `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${log}"
case "$1" in
  inspect) printf '${mounts.replace(/\n/g, "\\n")}' ;;
  exec)
    shift 2 # exec <container>
    case "$*" in
      "docker system df"*) printf 'TYPE TOTAL ACTIVE SIZE RECLAIMABLE\\nImages 10 2 4.704GB 2.181GB (46%%)\\n${cacheLine}\\n' ;;
      "docker ps -q") printf '${running}' ;;
    esac ;;
esac
`,
  );
  chmodSync(bin, 0o755);
  return {
    dir,
    log,
    env: { PATH: `${dir}:${process.env.PATH}`, GLANTRI_OPS_LOG_DIR: path.join(dir, "logs") },
  };
}

const calls = (fake) =>
  existsSync(fake.log) ? readFileSync(fake.log, "utf8").trim().split("\n") : [];

test("dind-cache: status parses Build Cache and flags alert at 80% of ceiling", () => {
  const ok = fakeDocker({ cacheLine: "Build Cache     27        0         3.836GB   624MB" });
  const okRun = run(dindCache, ["status"], ok.env);
  assert.equal(okRun.status, 0);
  assert.match(okRun.stdout, /level=OK build_cache_gb=3 /);
  const bad = fakeDocker({ cacheLine: "Build Cache     2596        0         721.4GB   721.4GB" });
  const badRun = run(dindCache, ["status"], bad.env);
  assert.equal(badRun.status, 10);
  assert.match(badRun.stdout, /level=ALERT build_cache_gb=721 /);
});

test("dind-cache: record appends to the log and returns the alert status", () => {
  const fake = fakeDocker({ cacheLine: "Build Cache     50        0         36.0GB   30GB" });
  const result = run(dindCache, ["record"], fake.env);
  assert.equal(result.status, 10);
  const log = readFileSync(path.join(fake.env.GLANTRI_OPS_LOG_DIR, "dind-cache.log"), "utf8");
  assert.match(log, /build_cache_gb=36 rc=10/);
});

test("dind-cache: prune issues exactly the two scoped builder-prune commands, inside the DinD container", () => {
  const fake = fakeDocker({ cacheLine: "Build Cache     2        0         50GB   50GB" });
  const result = run(dindCache, ["prune"], fake.env);
  assert.equal(result.status, 0, result.stderr);
  const argv = calls(fake);
  assert.deepEqual(
    argv.filter((line) => line.includes("prune")),
    [
      "exec glantri-forgejo-actions-dind docker builder prune --force --all --filter unused-for=336h",
      "exec glantri-forgejo-actions-dind docker builder prune --force --all --max-used-space 40GB",
    ],
  );
  // Every docker invocation is either a read-only inspect or an exec into the fixed DinD container.
  for (const line of argv) {
    assert.match(
      line,
      /^(inspect |exec glantri-forgejo-actions-dind docker (system df|ps -q|builder prune ))/,
    );
  }
  for (const line of argv) {
    assert.doesNotMatch(line, /volume|system prune|image prune|container prune|\brmi?\b|--volumes/);
  }
});

test("dind-cache: prune refuses while an inner job container is running", () => {
  const fake = fakeDocker({
    cacheLine: "Build Cache     2        0         50GB   50GB",
    running: "abc123\\n",
  });
  const result = run(dindCache, ["prune"], fake.env);
  assert.equal(result.status, 2);
  assert.equal(calls(fake).filter((line) => line.includes("prune")).length, 0);
});

test("dind-cache: refuses when the DinD container has a docker.sock or foreign mount", () => {
  for (const mounts of [
    "/var/run/docker.sock /var/run/docker.sock\n",
    "/Users/someone/forgejo-data /data\n",
  ]) {
    const fake = fakeDocker({ mounts, cacheLine: "Build Cache 1 0 1GB 1GB" });
    const result = run(dindCache, ["prune"], fake.env);
    assert.equal(result.status, 2);
    assert.equal(calls(fake).filter((line) => line.startsWith("exec")).length, 0);
  }
});

test("operational automation contains no command able to delete volumes or run a blanket prune", () => {
  const forbidden = [
    /system\s+prune/,
    /volume\s+(prune|rm)/,
    /image\s+prune/,
    /container\s+prune/,
    /--volumes/,
    /docker\s+(rm|rmi)\b/,
    /\brm\s+-/,
    /compose\s+down\s+(-v|--volumes)/,
  ];
  const files = readdirSync(here).filter((name) => name.endsWith(".sh"));
  assert.ok(files.length >= 3);
  for (const name of files) {
    // Comments may legitimately name the forbidden verbs when explaining the rule.
    const code = readFileSync(path.join(here, name), "utf8")
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");
    for (const pattern of forbidden) {
      assert.doesNotMatch(code, pattern, `${name} matches ${pattern}`);
    }
  }
});

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
  });
}

function repoFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "release-wt-"));
  const origin = path.join(root, "origin.git");
  const main = path.join(root, "main");
  mkdirSync(origin);
  git(origin, "init", "--bare", "-b", "dev");
  git(root, "clone", origin, main);
  git(main, "config", "user.name", "t");
  git(main, "config", "user.email", "t@example.com");
  writeFileSync(path.join(main, "a.txt"), "a\n");
  git(main, "add", ".");
  git(main, "commit", "-m", "base");
  git(main, "push", "origin", "HEAD:dev");
  const linked = path.join(root, "wt");
  git(main, "worktree", "add", "-b", "task", linked);
  return { main, linked };
}

test("release-worktree: refuses unpushed, dirty, ahead-of-origin, primary and detached; releases only when reachable", () => {
  const { main, linked } = repoFixture();
  const release = (target, ...flags) =>
    spawnSync("bash", [releaseWorktree, target, ...flags], { encoding: "utf8" });

  // Branch never pushed.
  let result = release(linked, "--execute");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not exist on origin/);
  assert.ok(existsSync(linked));

  // Commit made in the worktree, branch pushed, then another local commit that is not pushed.
  git(linked, "config", "user.name", "t");
  git(linked, "config", "user.email", "t@example.com");
  writeFileSync(path.join(linked, "b.txt"), "b\n");
  git(linked, "add", ".");
  git(linked, "commit", "-m", "work");
  git(linked, "push", "origin", "task");
  writeFileSync(path.join(linked, "c.txt"), "c\n");
  git(linked, "add", ".");
  git(linked, "commit", "-m", "only copy");
  result = release(linked, "--execute");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NOT reachable/);
  assert.ok(existsSync(linked), "unpushed commit must keep its worktree");

  // Pushed but dirty.
  git(linked, "push", "origin", "task");
  writeFileSync(path.join(linked, "scratch.txt"), "untracked\n");
  result = release(linked, "--execute");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not clean/);
  assert.ok(existsSync(linked));
  execFileSync("rm", [path.join(linked, "scratch.txt")]);

  // Primary checkout is never releasable.
  result = release(main, "--execute");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /primary checkout/);

  // Dry run releases nothing.
  result = release(linked);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(linked));

  // Pushed and clean: released, branch kept.
  result = release(linked, "--execute");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!existsSync(linked));
  assert.match(git(main, "branch", "--list", "task"), /task/);
});

test("release-worktree: refuses a detached HEAD", () => {
  const { main, linked } = repoFixture();
  git(linked, "checkout", "--detach");
  const result = spawnSync("bash", [releaseWorktree, linked, "--execute"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /detached HEAD/);
  assert.ok(existsSync(linked));
  assert.ok(existsSync(main));
});

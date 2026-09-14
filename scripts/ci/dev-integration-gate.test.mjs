import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parsers as yaml } from "prettier/plugins/yaml";
import { aggregate, collectPlan, parseChanges } from "./dev-integration-gate.mjs";
import { checkLinks } from "./dev-integration-gate-docs.mjs";

function fixture(t) {
  const cwd = mkdtempSync(path.join(tmpdir(), "glantri-gate-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Gate test",
        "-c",
        "user.email=gate@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  function write(file, source = "test\n") {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    writeFileSync(path.join(cwd, file), source);
  }
  function commit() {
    git("add", ".");
    git("commit", "-qm", "fixture");
    return git("rev-parse", "HEAD");
  }
  git("init", "-q");
  write("README.md", "# Fixture\n");
  const base = commit();
  function plan(event = "pull_request", target = "dev", from = base) {
    return collectPlan({ cwd, base: from, head: git("rev-parse", "HEAD"), event, target });
  }
  return { cwd, git, write, commit, base, plan };
}

function successful(plan) {
  return Object.fromEntries(
    ["changes", "docs", "tooling", "application-ci", "application-docker-test"].map((job) => [
      job,
      {
        result: plan.required.includes(job) ? "success" : "skipped",
        ...(job === "changes"
          ? {
              outputs: Object.fromEntries(
                ["base", "head", "mergeBase", "event", "target", "tooling", "runtime"].map(
                  (key) => [key, String(plan[key])],
                ),
              ),
            }
          : {}),
      },
    ]),
  );
}

test("real docs/process diff passes despite unrelated application and Docker failure", (t) => {
  const f = fixture(t);
  f.write("docs/process/policy.md");
  f.commit();
  const plan = f.plan();
  assert.deepEqual(plan.required, ["changes", "docs"]);
  const needs = successful(plan);
  needs["application-ci"].result = "failure";
  needs["application-docker-test"].result = "failure";
  assert.match(aggregate(plan, needs), /^PASS /);
});

test("real application diff requires the complete application and Docker gates", (t) => {
  const f = fixture(t);
  f.write("apps/api/src/example.ts");
  f.commit();
  const plan = f.plan();
  assert.deepEqual(plan.required, ["changes", "docs", "application-ci", "application-docker-test"]);
  const needs = successful(plan);
  needs["application-docker-test"].result = "failure";
  assert.throws(() => aggregate(plan, needs), /application-docker-test: failure/);
});

test("real workflow and executable test changes invoke focused tooling validation", (t) => {
  const f = fixture(t);
  f.write(".github/workflows/ci.yml");
  f.write("scripts/ci/dev-integration-gate.test.mjs");
  f.commit();
  const plan = f.plan();
  assert.deepEqual(plan.required, ["changes", "docs", "tooling"]);
  const needs = successful(plan);
  needs.tooling.result = "skipped";
  assert.throws(() => aggregate(plan, needs), /tooling: skipped/);
});

for (const scenario of ["deleted", "renamed-away", "broken-modified"]) {
  test(`formatter ${scenario} cannot pass without application validation`, (t) => {
    const f = fixture(t);
    const formatter = "scripts/checkChangedFormatting.mjs";
    f.write(
      formatter,
      readFileSync(new URL("../checkChangedFormatting.mjs", import.meta.url), "utf8"),
    );
    const base = f.commit();
    if (scenario === "deleted") f.git("rm", formatter);
    else if (scenario === "renamed-away") {
      // Both paths were previously allowlisted, so an unknown destination must
      // not accidentally supply the missing application-validation requirement.
      f.write(
        "scripts/ci/dev-integration-gate-renamed-formatter.mjs",
        f.git("show", `${base}:${formatter}`),
      );
      f.git("rm", formatter);
    } else f.write(formatter, 'throw new Error("fixture formatting failure");\n');
    f.commit();

    assert.throws(
      () => execFileSync(process.execPath, [formatter, base], { cwd: f.cwd, stdio: "pipe" }),
      (error) => {
        assert.match(
          error.stderr.toString(),
          scenario === "broken-modified" ? /fixture formatting failure/ : /MODULE_NOT_FOUND/,
        );
        return true;
      },
      "the retained application formatting command must expose the broken fixture",
    );
    for (const event of ["pull_request", "push"]) {
      const plan = f.plan(event, "dev", base);
      const applicationJobs =
        event === "pull_request"
          ? ["application-ci", "application-docker-test"]
          : ["application-ci"];
      for (const job of applicationJobs) {
        for (const result of ["skipped", "failure", undefined]) {
          const needs = successful(plan);
          if (result === undefined) delete needs[job];
          else needs[job].result = result;
          assert.throws(
            () => aggregate(plan, needs),
            /Required job application-/,
            `${event}: ${job} ${result ?? "missing"} must block the formatter change`,
          );
        }
      }
      assert.deepEqual(plan.required, ["changes", "docs", "tooling", ...applicationJobs]);
      assert.match(aggregate(plan, successful(plan)), /^PASS /);
    }
  });
}

test("mixed docs and runtime retains both surfaces and cannot get docs-only treatment", (t) => {
  const f = fixture(t);
  f.write("docs/process/policy.md");
  f.write("packages/database/prisma/schema.prisma");
  f.commit();
  const plan = f.plan();
  assert.equal(plan.docs, true);
  assert.equal(plan.runtime, true);
  const needs = successful(plan);
  needs["application-ci"].result = "skipped";
  assert.throws(() => aggregate(plan, needs), /application-ci: skipped/);
  needs["application-ci"].result = "success";
  needs.docs.result = "failure";
  assert.throws(() => aggregate(plan, needs), /docs: failure/);
});

for (const file of [
  "unknown.sh",
  "docs/process/policy.mjs",
  "scripts/ci/forgejo-runner-service.sh",
  ".github/workflows/deploy.yml",
  "package.json",
  "pnpm-lock.yaml",
  "docs/source/table.xlsx",
  "docs/rules/rule.md",
]) {
  test(`unknown/sensitive path fails closed to all gates: ${file}`, (t) => {
    const f = fixture(t);
    f.write(file);
    f.commit();
    assert.deepEqual(f.plan().required, [
      "changes",
      "docs",
      "tooling",
      "application-ci",
      "application-docker-test",
    ]);
  });
}

test("runtime executable tests are never documentation", (t) => {
  const f = fixture(t);
  f.write("apps/web/e2e/example.test.ts");
  f.commit();
  assert.equal(f.plan().runtime, true);
});

test("renaming runtime code into documentation retains the deleted runtime path", (t) => {
  const f = fixture(t);
  f.write("apps/api/src/a.ts");
  const base = f.commit();
  f.write("docs/process/a.md");
  f.git("rm", "apps/api/src/a.ts");
  f.commit();
  const plan = f.plan("pull_request", "dev", base);
  assert.deepEqual(
    plan.changes.map((c) => [c.path, c.status]),
    [
      ["apps/api/src/a.ts", "D"],
      ["docs/process/a.md", "A"],
    ],
  );
  assert.equal(plan.runtime, true);
});

test("executable bit and symlink under docs fail closed", (t) => {
  const f = fixture(t);
  f.write("docs/process/run.md");
  chmodSync(path.join(f.cwd, "docs/process/run.md"), 0o755);
  symlinkSync("../../README.md", path.join(f.cwd, "docs/process/link.md"));
  f.commit();
  assert.deepEqual(f.plan().required, [
    "changes",
    "docs",
    "tooling",
    "application-ci",
    "application-docker-test",
  ]);
});

test("missing, zero, unavailable, empty and stale SHA evidence fails closed", (t) => {
  const f = fixture(t);
  const options = { cwd: f.cwd, head: f.base, event: "pull_request", target: "dev" };
  for (const base of [undefined, "", "dev", "0".repeat(40), "f".repeat(40), f.base])
    assert.throws(() => collectPlan({ ...options, base }));
  f.write("docs/process/a.md");
  f.commit();
  assert.throws(() => collectPlan({ ...options, base: f.base }), /Checkout does not match/);
  assert.throws(() => f.plan("schedule", "dev"), /event/);
});

test("malformed path evidence and control-character filenames fail closed", (t) => {
  for (const raw of [
    "",
    "M\0docs/a.md\0",
    "anything",
    ":100644 100644 " + "a".repeat(40) + " " + "b".repeat(40) + " M\0../x\0",
  ])
    assert.throws(() => parseChanges(raw));
  const f = fixture(t);
  f.write("docs/process/bad\nname.md");
  f.commit();
  assert.throws(() => f.plan(), /Invalid changed-path/);
});

test("space-containing paths are preserved without shell interpretation", (t) => {
  const f = fixture(t);
  f.write("docs/process/space $(literal).md");
  f.commit();
  assert.equal(f.plan().changes[0].path, "docs/process/space $(literal).md");
  assert.equal(f.plan().runtime, false);
});

test("PR diff uses merge base and records exact current base independently", (t) => {
  const f = fixture(t);
  f.write("docs/process/task.md");
  const head = f.commit();
  f.git("checkout", "--detach", f.base);
  f.write("apps/api/base-only.ts");
  const advanced = f.commit();
  f.git("checkout", "--detach", head);
  const plan = f.plan("pull_request", "dev", advanced);
  assert.equal(plan.base, advanced);
  assert.equal(plan.mergeBase, f.base);
  assert.deepEqual(
    plan.changes.map((c) => c.path),
    ["docs/process/task.md"],
  );
});

test("all missing, failed, cancelled, skipped, pending and invalid applicable results reject", (t) => {
  const f = fixture(t);
  f.write("unknown.sh");
  f.commit();
  const plan = f.plan();
  for (const job of plan.required) {
    for (const status of [
      undefined,
      "failure",
      "cancelled",
      "canceled",
      "skipped",
      "pending",
      "",
      "neutral",
    ]) {
      const needs = successful(plan);
      needs[job].result = status;
      assert.throws(() => aggregate(plan, needs), /Required job/);
    }
    const needs = successful(plan);
    delete needs[job];
    assert.throws(() => aggregate(plan, needs), /Required job/);
  }
  assert.match(aggregate(plan, successful(plan)), /^PASS /);
});

test("aggregate rejects altered classification flags or any stale provenance field", (t) => {
  const f = fixture(t);
  f.write("docs/process/a.md");
  f.commit();
  const plan = f.plan();
  for (const key of ["base", "head", "mergeBase", "event", "target", "tooling", "runtime"]) {
    const needs = successful(plan);
    needs.changes.outputs[key] = "wrong";
    assert.throws(() => aggregate(plan, needs), /mismatch/);
  }
});

test("main/release validation stays full and Docker remains PR-only", (t) => {
  const f = fixture(t);
  f.write("docs/process/a.md");
  f.commit();
  assert.deepEqual(f.plan("pull_request", "main").required, [
    "changes",
    "docs",
    "tooling",
    "application-ci",
    "application-docker-test",
  ]);
  assert.deepEqual(f.plan("push", "main").required, [
    "changes",
    "docs",
    "tooling",
    "application-ci",
  ]);
});

test("documentation validates links, headings, references, spaces and duplicate headings", async (t) => {
  const f = fixture(t);
  f.write("docs/process/target file.md", "# Heading\n\n# Heading\n");
  f.write(
    "docs/process/a.md",
    "[one](<target file.md#heading-1>)\n\n[two][ref]\n\n[ref]: ../../README.md#fixture\n\n`[ignored](missing.md)`\n",
  );
  await checkLinks(["docs/process/a.md"], f.cwd);
  f.write("docs/process/a.md", "[bad](target%20file.md#missing)\n");
  await assert.rejects(checkLinks(["docs/process/a.md"], f.cwd), /missing heading/);
  f.write("docs/process/a.md", "[bad](deleted.md)\n");
  await assert.rejects(checkLinks(["docs/process/a.md"], f.cwd), /missing or out-of-repository/);
  await assert.rejects(
    checkLinks(["docs/process/a.md"], f.cwd, new Set(["docs/process/deleted.md"])),
    /missing/,
  );
  await checkLinks(["docs/process/a.md"], f.cwd, new Set(["unrelated.md"]));
  f.write("docs/process/a.md", "Ordinary [placeholder] text.\n");
  await checkLinks(["docs/process/a.md"], f.cwd);
  f.write("docs/process/a.md", "[unresolved][reference]\n");
  await checkLinks(["docs/process/a.md"], f.cwd, new Set(["unrelated.md"]));
  await assert.rejects(checkLinks(["docs/process/a.md"], f.cwd), /undefined reference/);
});

// Decode only ordinary YAML nodes from the already-declared Prettier parser.
// Unsupported aliases/tags fail the static check rather than hiding job policy.
function yamlValue(node) {
  if (node.anchor || node.tag || node.type === "alias")
    throw new Error("Unsupported workflow alias/tag");
  if (node.type === "mapping") {
    const pairs = node.children.map((item) => item.children.map(yamlValue));
    assert.equal(new Set(pairs.map(([key]) => key)).size, pairs.length, "duplicate YAML key");
    return Object.fromEntries(pairs);
  }
  if (["sequence", "flowSequence"].includes(node.type)) return node.children.map(yamlValue);
  if ("value" in node) return node.value;
  if (!node.children?.length) return null;
  assert.equal(node.children.length, 1, `unsupported YAML node ${node.type}`);
  return yamlValue(node.children[0]);
}

test("actual workflow parses and preserves aggregate dependencies, event head and application semantics", () => {
  const source = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const document = yaml.yaml.parse(source).children[0];
  const workflow = yamlValue(document.children.find((n) => n.type === "documentBody"));
  assert.equal(workflow.name, "CI");
  assert.deepEqual(Object.keys(workflow.on).sort(), ["pull_request", "push"]);
  const jobs = workflow.jobs;
  assert.deepEqual(jobs["dev-integration-gate"].needs, [
    "changes",
    "docs",
    "tooling",
    "application-ci",
    "application-docker-test",
  ]);
  assert.equal(jobs["dev-integration-gate"].if, "always()");
  assert.equal(jobs["application-ci"].if, "needs.changes.outputs.runtime == 'true'");
  assert.equal(
    jobs["application-docker-test"].if,
    "forgejo.event_name == 'pull_request' && needs.changes.outputs.runtime == 'true'",
  );
  assert.equal(jobs.tooling.if, "needs.changes.outputs.tooling == 'true'");
  assert.equal(jobs.docs.needs, "changes");
  assert.equal(jobs.docs.if, undefined);
  for (const legacy of ["ci", "docker-test"]) {
    assert.equal(jobs[legacy].needs, "dev-integration-gate");
    assert.ok(jobs[legacy].if.startsWith("always()"));
    assert.equal(jobs[legacy].steps.length, 1);
    assert.equal(jobs[legacy].steps[0].env.GATE_RESULT, "${{ needs.dev-integration-gate.result }}");
    assert.equal(jobs[legacy].steps[0].run, 'test "$GATE_RESULT" = success');
    assert.equal(jobs[legacy].services, undefined);
    for (const result of ["failure", "cancelled", "skipped", "pending", ""]) {
      assert.throws(
        () =>
          execFileSync("sh", ["-c", jobs[legacy].steps[0].run], {
            env: { ...process.env, GATE_RESULT: result },
            stdio: "pipe",
          }),
        `legacy ${legacy} must reject aggregate ${result || "missing"}`,
      );
    }
    execFileSync("sh", ["-c", jobs[legacy].steps[0].run], {
      env: { ...process.env, GATE_RESULT: "success" },
      stdio: "pipe",
    });
  }
  for (const job of Object.values(jobs)) {
    assert.equal(job["runs-on"], "glantri-private-ci");
    for (const step of job.steps) {
      assert.equal(step["continue-on-error"], undefined);
      if (step.uses?.includes("checkout@"))
        assert.equal(step.with.ref, "${{ forgejo.event.pull_request.head.sha || forgejo.sha }}");
    }
  }
  const commands = jobs["application-ci"].steps.map((step) => step.run).join("\n");
  for (const command of ["pnpm typecheck", "pnpm lint", "pnpm test", "pnpm coverage", "pnpm build"])
    assert.ok(commands.includes(command));
  const dockerSteps = jobs["application-docker-test"].steps;
  assert.equal(
    dockerSteps.find((s) => s.name === "Remove run-owned Docker resources").if,
    "always()",
  );
  assert.ok(dockerSteps.some((s) => s.run?.includes("prisma migrate deploy")));
  assert.ok(dockerSteps.some((s) => s.run?.includes("playwright test --reporter=list,html")));
  assert.equal(
    dockerSteps.find((s) => s.name === "Upload Playwright report on failure").with[
      "retention-days"
    ],
    "7",
  );
});

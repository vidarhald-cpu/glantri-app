import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  chmodSync,
  existsSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parsers as yaml } from "prettier/plugins/yaml";
import { aggregate, collectPlan, parseChanges } from "./dev-integration-gate.mjs";
import { checkLinks } from "./dev-integration-gate-docs.mjs";

const serviceHelperPaths = [
  "scripts/ci/current-run-services.mjs",
  "scripts/ci/current-run-services.synthetic.sh",
  "scripts/ci/current-run-services.test.mjs",
  "scripts/ci/sanitize-service-logs.mjs",
];

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

for (const helper of serviceHelperPaths) {
  test(`exact service helper requires mandatory tooling validation: ${helper}`, (t) => {
    const f = fixture(t);
    f.write(helper);
    f.commit();
    const plan = f.plan();
    assert.deepEqual(plan.required, ["changes", "docs", "tooling"]);
    for (const result of ["skipped", "failure", undefined]) {
      const needs = successful(plan);
      if (result === undefined) delete needs.tooling;
      else needs.tooling.result = result;
      assert.throws(() => aggregate(plan, needs), /Required job tooling/);
    }
  });
}

test("deleted service helper remains tooling-only but cannot bypass its mandatory job", (t) => {
  const f = fixture(t);
  const helper = serviceHelperPaths[0];
  f.write(helper);
  const base = f.commit();
  f.git("rm", helper);
  f.commit();
  const plan = f.plan("pull_request", "dev", base);
  assert.deepEqual(plan.required, ["changes", "docs", "tooling"]);
  const needs = successful(plan);
  needs.tooling.result = "failure";
  assert.throws(() => aggregate(plan, needs), /Required job tooling: failure/);
});

test("renamed-away, executable and symlink service helpers fail closed to full validation", (t) => {
  const renamed = fixture(t);
  renamed.write(serviceHelperPaths[0]);
  const base = renamed.commit();
  renamed.write("scripts/ci/renamed-service-helper.mjs");
  renamed.git("rm", serviceHelperPaths[0]);
  renamed.commit();
  assert.deepEqual(renamed.plan("pull_request", "dev", base).required, [
    "changes",
    "docs",
    "tooling",
    "application-ci",
    "application-docker-test",
  ]);

  const modes = fixture(t);
  modes.write(serviceHelperPaths[1]);
  chmodSync(path.join(modes.cwd, serviceHelperPaths[1]), 0o755);
  symlinkSync("current-run-services.mjs", path.join(modes.cwd, serviceHelperPaths[3]));
  modes.commit();
  assert.deepEqual(modes.plan().required, [
    "changes",
    "docs",
    "tooling",
    "application-ci",
    "application-docker-test",
  ]);
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
  "infra/forgejo-actions/runner-config.template.yml",
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
  assert.equal(
    jobs.tooling.env.CI_SYNTHETIC_IMAGE,
    "docker.io/library/node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32",
  );
  assert.equal(
    jobs.tooling.env.CI_RESOURCE_SUFFIX,
    "tooling-${{ forgejo.run_id }}-${{ forgejo.run_attempt }}",
  );
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
  const toolingCommands = jobs.tooling.steps.map((step) => step.run).join("\n");
  for (const command of [
    'docker pull "$CI_SYNTHETIC_IMAGE"',
    "node --test scripts/ci/current-run-services.test.mjs",
    "node scripts/ci/sanitize-service-logs.mjs",
    "bash scripts/ci/current-run-services.synthetic.sh",
  ])
    assert.ok(toolingCommands.includes(command), `missing mandatory tooling command: ${command}`);
  assert.equal(
    jobs["application-docker-test"].env.CI_SERVICE_STATE_DIR,
    ".ci/current-run-services",
  );
  const dockerCommands = dockerSteps.map((step) => step.run).join("\n");
  for (const command of [
    "assert-ports-free",
    "current-run-services.mjs reclaim-stale",
    "current-run-services.test.mjs",
    "current-run-services.synthetic.sh",
    "current-run-services.mjs record",
    "current-run-services.mjs verify",
    "current-run-services.mjs wait-http",
    "current-run-services.mjs logs",
    "current-run-services.mjs cleanup",
    "sanitize-service-logs.mjs",
  ])
    assert.ok(dockerCommands.includes(command), `missing application Docker command: ${command}`);
  assert.equal(
    dockerSteps.find((s) => s.name === "Remove run-owned Docker resources").if,
    "always()",
  );
  const reclaimIndex = dockerSteps.findIndex((s) => s.run?.includes("reclaim-stale"));
  const assertPortsIndex = dockerSteps.findIndex((s) => s.run?.includes("assert-ports-free"));
  assert.ok(reclaimIndex >= 0, "stale service reclamation must run in application-docker-test");
  assert.ok(
    reclaimIndex < assertPortsIndex,
    "stale service reclamation must precede the retained port collision assertion",
  );
  for (const service of ["api", "web"]) {
    const start = dockerSteps.find(
      (s) => s.name === `Start ${service === "api" ? "API" : "Web"} container`,
    );
    for (const label of [
      "--label com.glantri.ci.owner=glantri-browser-service",
      '--label "com.glantri.ci.resource-suffix=$CI_RESOURCE_SUFFIX"',
      '--label "com.glantri.ci.job-container=$owner_job_container"',
    ])
      assert.ok(
        start.run.includes(label),
        `${service} service must carry ownership label ${label}`,
      );
  }
  assert.ok(dockerSteps.some((s) => s.run?.includes("prisma migrate deploy")));
  assert.ok(dockerSteps.some((s) => s.run?.includes("playwright test --reporter=list,html")));
  assert.equal(
    dockerSteps.find((s) => s.name === "Upload Playwright report on failure").with[
      "retention-days"
    ],
    "7",
  );
});

// The Forgejo address the runner polls is configuration, not a constant. These
// tests drive the real service script in a disposable runner home: no Docker,
// no registration and no token are involved, because the address resolution,
// the rendered configuration and the address `verify` probes are all reachable
// through `refresh-config` and `print-endpoint`.
const runnerService = fileURLToPath(new URL("./forgejo-runner-service.sh", import.meta.url));
const runnerTemplate = new URL(
  "../../infra/forgejo-actions/runner-config.template.yml",
  import.meta.url,
);
const defaultForgejoUrl = "http://host.docker.internal:3001/";
const macStudioForgejoUrl = "http://192.168.1.66:3001/";
const fixtureRunnerUuid = "3f0d1b2c-4e5a-6789-abcd-ef0123456789";

function runnerHome(t, { state = true } = {}) {
  const home = mkdtempSync(path.join(tmpdir(), "glantri-runner-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  if (state) mkdirSync(path.join(home, "state"));
  return home;
}

function runnerCommand(home, args, forgejoUrl = "") {
  return execFileSync("bash", [runnerService, ...args], {
    encoding: "utf8",
    env: { ...process.env, GLANTRI_RUNNER_HOME: home, GLANTRI_FORGEJO_URL: forgejoUrl },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runnerFailure(home, args, forgejoUrl = "") {
  try {
    runnerCommand(home, args, forgejoUrl);
  } catch (error) {
    return { status: error.status, stderr: error.stderr.toString() };
  }
  throw new Error(`expected the runner service to refuse ${args.join(" ")}`);
}

function renderedConfig(home) {
  return readFileSync(path.join(home, "state/runner-config.yml"), "utf8");
}

function renderedForgejoUrl(home) {
  return /^ {6}url: (.*)$/m.exec(renderedConfig(home))?.[1];
}

function persistedForgejoUrl(home) {
  return readFileSync(path.join(home, "state/forgejo-url"), "utf8");
}

// A real rendered configuration for `url`, produced by the script itself. The
// `bootstrapped` shape is what `bootstrap` leaves behind; `pre-change` is the
// shape an installation registered before the address became configurable has,
// and the shape this Mac's live installation holds: a rendered configuration
// naming its Forgejo, and no address file beside it.
function installation(t, url, shape = "bootstrapped") {
  const home = runnerHome(t);
  writeFileSync(path.join(home, "state/forgejo-url"), `${url}\n`);
  writeFileSync(path.join(home, "state/runner-config.yml"), `      uuid: ${fixtureRunnerUuid}\n`);
  runnerCommand(home, ["refresh-config"]);
  assert.equal(renderedForgejoUrl(home), url);
  if (shape === "pre-change") rmSync(path.join(home, "state/forgejo-url"));
  return home;
}

function treeSnapshot(home) {
  const entries = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(home, absolute);
      if (entry.isDirectory()) {
        entries.push(`directory ${relative}`);
        walk(absolute);
      } else entries.push(`file ${relative} ${readFileSync(absolute, "utf8")}`);
    }
  };
  walk(home);
  return entries;
}

test("runner service renders the committed default Forgejo address when nothing is configured", (t) => {
  const fresh = runnerHome(t, { state: false });
  assert.equal(runnerCommand(fresh, ["print-endpoint", "bootstrap"]), defaultForgejoUrl);
  assert.deepEqual(treeSnapshot(fresh), []);
  const home = installation(t, defaultForgejoUrl);
  assert.equal(renderedForgejoUrl(home), defaultForgejoUrl);
  assert.equal(persistedForgejoUrl(home), `${defaultForgejoUrl}\n`);
  assert.ok(!renderedConfig(home).includes("__FORGEJO_URL__"));
  assert.match(renderedConfig(home), new RegExp(`^ {6}uuid: ${fixtureRunnerUuid}$`, "m"));
  assert.equal(runnerCommand(home, ["print-endpoint"]), defaultForgejoUrl);
  assert.equal(runnerCommand(home, ["print-endpoint", "verify"]), defaultForgejoUrl);
});

test("runner service adopts a configured Forgejo address and keeps it across refreshes", (t) => {
  const fresh = runnerHome(t, { state: false });
  assert.equal(
    runnerCommand(fresh, ["print-endpoint", "bootstrap"], macStudioForgejoUrl),
    macStudioForgejoUrl,
  );
  assert.deepEqual(treeSnapshot(fresh), []);
  const home = installation(t, macStudioForgejoUrl);
  // Every later `up` and `restart` re-renders the template with no environment
  // set; an address taken only from the environment would revert here.
  for (const pass of [1, 2]) {
    runnerCommand(home, ["refresh-config"]);
    assert.equal(renderedForgejoUrl(home), macStudioForgejoUrl, `refresh ${pass}`);
    assert.equal(persistedForgejoUrl(home), `${macStudioForgejoUrl}\n`, `refresh ${pass}`);
  }
  assert.equal(runnerCommand(home, ["print-endpoint"]), macStudioForgejoUrl);
  assert.equal(runnerCommand(home, ["print-endpoint", "verify"]), macStudioForgejoUrl);
  // The rendered configuration differs from the committed template in exactly
  // the two substituted placeholders, so the address is inserted literally.
  assert.equal(
    renderedConfig(home),
    readFileSync(runnerTemplate, "utf8")
      .replace("__RUNNER_UUID__", () => fixtureRunnerUuid)
      .replace("__FORGEJO_URL__", () => macStudioForgejoUrl),
  );
});

test("runner service refuses to repoint a registered runner from the environment", (t) => {
  const home = installation(t, defaultForgejoUrl);
  const refusal = runnerFailure(home, ["refresh-config"], macStudioForgejoUrl);
  assert.equal(refusal.status, 2);
  assert.match(
    refusal.stderr,
    /GLANTRI_FORGEJO_URL is http:\/\/192\.168\.1\.66:3001\/ but this installation is registered against http:\/\/host\.docker\.internal:3001\/, recorded in \S+\/state\/forgejo-url\./,
  );
  assert.match(refusal.stderr, /state\/forgejo-url and run restart/);
  assert.equal(renderedForgejoUrl(home), defaultForgejoUrl);
  assert.equal(persistedForgejoUrl(home), `${defaultForgejoUrl}\n`);
  assert.equal(runnerFailure(home, ["print-endpoint"], macStudioForgejoUrl).status, 2);
  // On an installation registered before the address became configurable the
  // record is its rendered configuration, and the refusal names that address
  // rather than the compiled default.
  const preChange = installation(t, macStudioForgejoUrl, "pre-change");
  const against = runnerFailure(preChange, ["print-endpoint"], defaultForgejoUrl);
  assert.equal(against.status, 2);
  assert.match(
    against.stderr,
    /registered against http:\/\/192\.168\.1\.66:3001\/, recorded in \S+\/state\/runner-config\.yml\./,
  );
  assert.equal(existsSync(path.join(preChange, "state/forgejo-url")), false);
});

test("runner service never invents a registration for an installation that has none", (t) => {
  const fresh = runnerHome(t, { state: false });
  // There is nothing to repoint, so the configured address is simply the one
  // `bootstrap` would use, and no command may fabricate a record that refuses it.
  assert.equal(
    runnerCommand(fresh, ["print-endpoint", "bootstrap"], macStudioForgejoUrl),
    macStudioForgejoUrl,
  );
  for (const args of [["print-endpoint"], ["print-endpoint", "verify"], ["refresh-config"]]) {
    const refusal = runnerFailure(fresh, args, macStudioForgejoUrl);
    assert.notEqual(refusal.status, 0);
    assert.doesNotMatch(refusal.stderr, /Refusing to repoint/, args.join(" "));
    assert.deepEqual(treeSnapshot(fresh), [], args.join(" "));
  }
  assert.match(
    runnerFailure(fresh, ["print-endpoint"], macStudioForgejoUrl).stderr,
    /has no registered Forgejo address[\s\S]*Run bootstrap to register a runner/,
  );
  assert.equal(
    runnerCommand(fresh, ["print-endpoint", "bootstrap"], macStudioForgejoUrl),
    macStudioForgejoUrl,
  );
});

test("runner service adopts a pre-change installation's own rendered address, not the default", (t) => {
  // The live installation on this Mac holds a rendered configuration and a
  // token and no address file. Resolving must not overwrite the address it is
  // registered against with the compiled default.
  const home = installation(t, macStudioForgejoUrl, "pre-change");
  assert.equal(runnerCommand(home, ["print-endpoint"]), macStudioForgejoUrl);
  assert.equal(runnerCommand(home, ["print-endpoint", "verify"]), macStudioForgejoUrl);
  assert.equal(existsSync(path.join(home, "state/forgejo-url")), false);
  // `up` and `restart` re-render first: the rendered address survives and is
  // recorded, rather than being replaced by the default.
  runnerCommand(home, ["refresh-config"]);
  assert.equal(renderedForgejoUrl(home), macStudioForgejoUrl);
  assert.equal(persistedForgejoUrl(home), `${macStudioForgejoUrl}\n`);
  assert.equal(runnerCommand(home, ["print-endpoint", "verify"]), macStudioForgejoUrl);
});

test("runner service print-endpoint and verify resolution write nothing at all", (t) => {
  const states = [
    ["fresh", runnerHome(t, { state: false })],
    ["empty state directory", runnerHome(t)],
    ["pre-change", installation(t, macStudioForgejoUrl, "pre-change")],
    ["bootstrapped", installation(t, macStudioForgejoUrl)],
  ];
  for (const [name, home] of states) {
    const before = treeSnapshot(home);
    for (const args of [
      ["print-endpoint"],
      ["print-endpoint", "service"],
      ["print-endpoint", "bootstrap"],
      ["print-endpoint", "verify"],
    ])
      for (const forgejoUrl of ["", macStudioForgejoUrl, defaultForgejoUrl]) {
        try {
          runnerCommand(home, args, forgejoUrl);
        } catch {
          // A refusal is a legitimate outcome here; writing is not.
        }
        assert.deepEqual(treeSnapshot(home), before, `${name}: ${args.join(" ")} ${forgejoUrl}`);
      }
  }
});

test("runner service verify target is the rendered address and refuses a disagreement", (t) => {
  const home = installation(t, defaultForgejoUrl);
  writeFileSync(path.join(home, "state/forgejo-url"), `${macStudioForgejoUrl}\n`);
  assert.equal(runnerCommand(home, ["print-endpoint"]), macStudioForgejoUrl);
  const refusal = runnerFailure(home, ["print-endpoint", "verify"]);
  assert.equal(refusal.status, 1);
  assert.match(
    refusal.stderr,
    /Rendered runner configuration uses http:\/\/host\.docker\.internal:3001\/ but this installation is registered against http:\/\/192\.168\.1\.66:3001\/, recorded in \S+\/state\/forgejo-url\./,
  );
  runnerCommand(home, ["refresh-config"]);
  assert.equal(renderedForgejoUrl(home), macStudioForgejoUrl);
  assert.equal(runnerCommand(home, ["print-endpoint", "verify"]), macStudioForgejoUrl);
  writeFileSync(
    path.join(home, "state/runner-config.yml"),
    `      url: __FORGEJO_URL__\n      uuid: ${fixtureRunnerUuid}\n`,
  );
  assert.equal(runnerFailure(home, ["print-endpoint", "verify"]).status, 2);
});

test("runner service rejects a Forgejo address that could break the rendered configuration", (t) => {
  for (const candidate of [
    "http://host.docker.internal:3001",
    "http://host.docker.internal:3001/api/healthz",
    "http://host:3001/;id",
    "http://a&b:3001/",
    "http://host:3001/?x=1",
    "https://user:pass@host:3001/",
    "http://*:3001/",
    "http://$(id):3001/",
    "ftp://host:3001/",
    "//host:3001/",
    "http://:3001/",
    "http://host:300100/",
    "http://host:3001//",
    "http://host..bad:3001/",
    "http://host-.bad:3001/",
    "http://host:3001/\nurl: http://evil.invalid/",
  ]) {
    const home = runnerHome(t, { state: false });
    const refusal = runnerFailure(home, ["print-endpoint", "bootstrap"], candidate);
    assert.equal(refusal.status, 2, candidate);
    assert.match(refusal.stderr, /is not an accepted Forgejo address/, candidate);
    assert.deepEqual(treeSnapshot(home), [], candidate);
  }
  const accepted = "https://forgejo-ci.example-host.test:65535/";
  const fresh = runnerHome(t, { state: false });
  assert.equal(runnerCommand(fresh, ["print-endpoint", "bootstrap"], accepted), accepted);
  assert.equal(renderedForgejoUrl(installation(t, accepted)), accepted);
});

test("committed runner template and service script carry one Forgejo address literal", () => {
  const template = readFileSync(runnerTemplate, "utf8");
  assert.match(template, /^ {6}url: __FORGEJO_URL__$/m);
  assert.deepEqual(template.match(/https?:\/\/[^\s'"]+/g), null);
  const script = readFileSync(new URL("./forgejo-runner-service.sh", import.meta.url), "utf8");
  // One address literal only: the documented default. A reintroduced literal in
  // `verify` cannot be reached without Docker, so it is caught here.
  assert.deepEqual(script.match(/https?:\/\/[^\s'"]+/g), [defaultForgejoUrl]);
  assert.match(script, /^FORGEJO_URL_DEFAULT='http:\/\/host\.docker\.internal:3001\/'$/m);
  assert.match(script, /--env "FORGEJO_HEALTH_URL=\$\{VERIFY_FORGEJO_URL\}api\/healthz"/);
  // Exactly one address is ever given to the probe. A second --env carrying a
  // variable passes the assertion above while docker run takes the last value.
  assert.deepEqual(script.match(/FORGEJO_HEALTH_URL=[^"\s]*/g), [
    "FORGEJO_HEALTH_URL=${VERIFY_FORGEJO_URL}api/healthz",
  ]);
  const probes = script.split("\n").filter((line) => line.includes("curl "));
  assert.equal(probes.length, 1);
  assert.match(probes[0], /curl --fail --silent --show-error "\$FORGEJO_HEALTH_URL"/);
});

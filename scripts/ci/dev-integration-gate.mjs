import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const shaPattern = /^[0-9a-f]{40}$/;
const docsPattern = /^(?:AGENTS\.md|README\.md|docs\/(?!source\/|rules\/).+\.md)$/;
// Application formatting uses checkChangedFormatting.mjs. Keep that helper on
// the full-validation fallback until its behavior has focused tooling coverage.
const toolingPattern =
  /^(?:\.github\/workflows\/ci\.yml|scripts\/ci\/dev-integration-gate[^/]*\.mjs)$/;

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export function parseChanges(raw) {
  if (!raw || !raw.endsWith("\0")) throw new Error("Missing or malformed changed-path evidence");
  const fields = raw.slice(0, -1).split("\0");
  const changes = [];
  for (let i = 0; i < fields.length; i += 2) {
    const match = /^:(\d{6}) (\d{6}) [0-9a-f]{40} [0-9a-f]{40} ([AMDT])$/.exec(fields[i]);
    const path = fields[i + 1];
    if (
      !match ||
      !path ||
      /[\x00-\x1f\x7f\\]/.test(path) ||
      path.startsWith("/") ||
      path.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      throw new Error("Invalid changed-path evidence");
    }
    changes.push({ path, oldMode: match[1], newMode: match[2], status: match[3] });
  }
  return changes;
}

export function classify(changes, event, target) {
  if (!Array.isArray(changes) || changes.length === 0)
    throw new Error("Empty changed-path evidence");
  if (!["pull_request", "push"].includes(event) || !target)
    throw new Error("Invalid event/target evidence");
  let docs = false;
  let tooling = false;
  let runtime = false;
  const reasons = [];
  for (const change of changes) {
    const { path, oldMode, newMode } = change;
    if (typeof path !== "string" || !path) throw new Error("Invalid changed path");
    const regular = [oldMode, newMode].every((mode) => ["000000", "100644"].includes(mode));
    if (regular && docsPattern.test(path)) docs = true;
    else if (regular && toolingPattern.test(path)) tooling = true;
    else {
      runtime = true;
      // Runtime source/tests/data always retain the existing full application gate.
      // Unknown, executable-mode, symlink, dependency and infrastructure changes
      // additionally require tooling validation; an extension never grants a bypass.
      if (!regular || !/^(apps|packages)\//.test(path)) tooling = true;
      reasons.push(path);
    }
  }
  // The approved lighter policy is only for dev integration and task pushes.
  // Release PRs and main pushes retain all application and tooling validation.
  if ((event === "pull_request" && target !== "dev") || target === "main") {
    runtime = true;
    tooling = true;
  }
  const required = ["changes", "docs"];
  if (tooling) required.push("tooling");
  if (runtime) required.push("application-ci");
  if (runtime && event === "pull_request") required.push("application-docker-test");
  return { docs, tooling, runtime, required, reasons };
}

export function collectPlan({ cwd = process.cwd(), base, head, event, target }) {
  for (const value of [base, head]) {
    if (!shaPattern.test(value ?? "") || /^0+$/.test(value))
      throw new Error("Exact nonzero base/head SHA required");
    if (git(cwd, ["rev-parse", "--verify", `${value}^{commit}`]).trim() !== value)
      throw new Error("Commit identity mismatch");
  }
  if (git(cwd, ["rev-parse", "HEAD"]).trim() !== head)
    throw new Error("Checkout does not match event head");
  const mergeBases = git(cwd, ["merge-base", "--all", base, head]).trim().split("\n");
  if (mergeBases.length !== 1 || !shaPattern.test(mergeBases[0]))
    throw new Error("Unique merge base required");
  const mergeBase = mergeBases[0];
  const changes = parseChanges(
    git(cwd, ["diff", "--raw", "--no-abbrev", "--no-renames", "-z", mergeBase, head, "--"]),
  );
  return { base, head, mergeBase, event, target, changes, ...classify(changes, event, target) };
}

export function aggregate(plan, needs) {
  if (!needs || typeof needs !== "object") throw new Error("Missing job results");
  const expected = classify(plan.changes, plan.event, plan.target);
  for (const job of expected.required) {
    if (needs[job]?.result !== "success")
      throw new Error(`Required job ${job}: ${needs[job]?.result ?? "missing"}`);
  }
  const output = needs.changes.outputs;
  for (const key of ["base", "head", "mergeBase", "event", "target"]) {
    if (output?.[key] !== plan[key]) throw new Error(`Classification provenance mismatch: ${key}`);
  }
  for (const key of ["tooling", "runtime"]) {
    if (output?.[key] !== String(expected[key])) throw new Error(`Classification mismatch: ${key}`);
  }
  return `PASS ${plan.head} against ${plan.base}: ${expected.required.join(", ")}`;
}

export function environmentPlan() {
  return collectPlan({
    base: process.env.GATE_BASE_SHA,
    head: process.env.GATE_HEAD_SHA,
    event: process.env.GATE_EVENT,
    target: process.env.GATE_TARGET,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const plan = environmentPlan();
    const command = process.argv[2];
    if (command === "classify") {
      console.log(JSON.stringify(plan, null, 2));
      const output = process.env.GITHUB_OUTPUT || process.env.FORGEJO_OUTPUT;
      if (!output) throw new Error("Missing Actions output file");
      for (const key of ["base", "head", "mergeBase", "event", "target", "tooling", "runtime"]) {
        if (/[\r\n]/.test(String(plan[key]))) throw new Error("Invalid output value");
        appendFileSync(output, `${key}=${plan[key]}\n`);
      }
    } else if (command === "aggregate") {
      console.log(aggregate(plan, JSON.parse(process.env.GATE_NEEDS ?? "null")));
    } else throw new Error("Expected classify or aggregate");
  } catch (error) {
    console.error(`dev-integration-gate: ${error.message}`);
    process.exitCode = 1;
  }
}

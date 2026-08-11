#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const THRESHOLD = Number(process.env.FILE_SIZE_THRESHOLD ?? 500);
const REPO_ROOT = process.cwd();

const SCAN_DIRS = [
  "apps/api/src",
  "apps/web/src",
  "apps/web/app",
  "packages/auth/src",
  "packages/content/src",
  "packages/database/src",
  "packages/domain/src",
  "packages/importers/src",
  "packages/rules-engine/src",
  "packages/shared/src",
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  ".next",
  "coverage",
  "data",
]);

function shouldSkipFile(name) {
  if (name.endsWith(".test.ts")) return true;
  if (name.endsWith(".test.tsx")) return true;
  if (name.endsWith(".component.test.tsx")) return true;
  if (name.endsWith(".d.ts")) return true;
  if (name.endsWith(".json")) return true;
  return false;
}

function shouldScanFile(name) {
  return name.endsWith(".ts") || name.endsWith(".tsx");
}

function walk(dir, results) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walk(join(dir, entry.name), results);
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldSkipFile(entry.name)) continue;
    if (!shouldScanFile(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    const content = readFileSync(fullPath, "utf8");
    const lines = content.split("\n").length;
    if (lines >= THRESHOLD) {
      results.push({ path: relative(REPO_ROOT, fullPath).replaceAll("\\", "/"), lines });
    }
  }
}

const results = [];
for (const dir of SCAN_DIRS) {
  walk(join(REPO_ROOT, dir), results);
}
results.sort((a, b) => b.lines - a.lines);

const summaryLines = [];
summaryLines.push(`## File-size report (threshold: ${THRESHOLD} lines)`);
summaryLines.push("");
if (results.length === 0) {
  summaryLines.push(`No production files at or above ${THRESHOLD} lines. ✅`);
} else {
  summaryLines.push(`Found **${results.length}** file(s) at or above the threshold:`);
  summaryLines.push("");
  summaryLines.push("| Lines | File |");
  summaryLines.push("|------:|------|");
  for (const r of results) {
    summaryLines.push(`| ${r.lines} | \`${r.path}\` |`);
  }
  summaryLines.push("");
  summaryLines.push("> Not a hard fail. Refactor large files when convenient — see `docs/architecture/system-overview.md` and the feature-mappe-mønsteret in `CLAUDE.md`.");
}

const summary = summaryLines.join("\n");
console.log(summary);

const githubSummary = process.env.GITHUB_STEP_SUMMARY;
if (githubSummary) {
  try {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(githubSummary, summary + "\n");
  } catch (err) {
    console.error("Failed to write GITHUB_STEP_SUMMARY:", err.message);
  }
}

process.exit(0);

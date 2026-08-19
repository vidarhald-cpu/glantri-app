#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { format as formatWithPrettier } from "prettier";

import conformanceReportModule from "../packages/domain/src/encounter/criticalEffectConformanceReport";
import type { CriticalWorkbookSummaryVerification } from "../packages/domain/src/encounter/criticalEffectConformanceReport";

const { renderCriticalEffectConformanceReport } = conformanceReportModule;

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const MANIFEST_PATH = resolve(
  REPO_ROOT,
  "packages/domain/src/encounter/criticalEffectsTableManifest.json",
);
const REPORT_PATH = resolve(REPO_ROOT, "docs/audits/critical-effects-conformance.md");

interface CriticalManifest {
  source: { sha256: string };
  validation: { workbookSummary: CriticalWorkbookSummaryVerification };
}

function repoPath(path: string): string {
  return relative(REPO_ROOT, path).replaceAll("\\", "/");
}

export async function buildCheckedInCriticalEffectConformanceReport(): Promise<string> {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as CriticalManifest;

  const report = renderCriticalEffectConformanceReport({
    sourceSha256: manifest.source.sha256,
    summaryVerification: manifest.validation.workbookSummary,
  });

  return formatWithPrettier(report, { filepath: REPORT_PATH, parser: "markdown" });
}

function verifyReport(expected: string): void {
  let actual: string;

  try {
    actual = readFileSync(REPORT_PATH, "utf8");
  } catch {
    throw new Error(`Critical conformance report is missing at ${repoPath(REPORT_PATH)}.`);
  }

  if (actual !== expected) {
    throw new Error(
      `Critical conformance report drift detected. Run the bounded generation mode and review the source/proposal diagnostics.`,
    );
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const generate = args.has("--generate");
  const verify = args.has("--verify");

  if (generate === verify) {
    throw new Error("Use exactly one mode: --verify or --generate.");
  }

  const report = await buildCheckedInCriticalEffectConformanceReport();

  if (verify) {
    verifyReport(report);
    console.log(`Critical conformance report verification passed: ${repoPath(REPORT_PATH)}.`);
    return;
  }

  writeFileSync(REPORT_PATH, report);
  console.log(`Generated ${repoPath(REPORT_PATH)}.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;

if (invokedPath === import.meta.url) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

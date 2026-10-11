import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Vitest's `forks` pool sizes itself from `os.availableParallelism() - 1`, and because
// `minForks` defaults to the same number, every `vitest run` spawns that many worker
// processes eagerly — even a package with three test files, or none.
//
// Nothing inside a test run can observe the real budget. On the Forgejo runner the job
// container reports 18 CPUs and 7932 MB, while the actual limits live on the parent
// `glantri-forgejo-actions-dind` cgroup (10 CPUs, 6 GiB); the job container's own
// `cpu.max` and `memory.max` are both `max`. `turbo test` then runs up to four package
// suites concurrently, each with its own full-width pool.
//
// Measured on that runtime and on the development machine (Forgejo #553): a peak of 34
// resident worker forks and 5.06 GB RSS for one `pnpm test`, against a 6 GiB ceiling the
// cgroup has hit 11 608 times, 16.8% of CPU periods throttled, and ~492 000 major faults.
// No process is ever killed, so the symptom is a stall, and the stall surfaces as
// `Test timed out in 5000ms` in whichever unrelated test happens to be mid-flight.
//
// Bound the per-suite pool instead of raising the timeouts the stalls trip. The default
// gives each concurrently scheduled suite a quarter of the reported parallelism;
// `GLANTRI_TEST_WORKERS` overrides it without touching a workflow definition.
export const CONCURRENT_SUITE_BUDGET = 4;

export function resolveTestWorkers(): number {
  const configured = Number.parseInt(process.env.GLANTRI_TEST_WORKERS ?? "", 10);

  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  const reportedParallelism =
    typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;

  return Math.max(1, Math.floor(reportedParallelism / CONCURRENT_SUITE_BUDGET));
}

const testWorkers = resolveTestWorkers();

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${path.join(repoRoot, "apps/web/src")}/`,
      },
      {
        find: /^@glantri\/auth$/,
        replacement: path.join(repoRoot, "packages/auth/src/index.ts"),
      },
      {
        find: /^@glantri\/auth\/(.*)$/,
        replacement: path.join(repoRoot, "packages/auth/src/$1"),
      },
      {
        find: /^@glantri\/content$/,
        replacement: path.join(repoRoot, "packages/content/src/index.ts"),
      },
      {
        find: /^@glantri\/content\/(.*)$/,
        replacement: path.join(repoRoot, "packages/content/src/$1"),
      },
      {
        find: /^@glantri\/database$/,
        replacement: path.join(repoRoot, "packages/database/src/index.ts"),
      },
      {
        find: /^@glantri\/database\/(.*)$/,
        replacement: path.join(repoRoot, "packages/database/src/$1"),
      },
      {
        find: /^@glantri\/domain$/,
        replacement: path.join(repoRoot, "packages/domain/src/index.ts"),
      },
      {
        find: /^@glantri\/domain\/(.*)$/,
        replacement: path.join(repoRoot, "packages/domain/src/$1"),
      },
      {
        find: /^@glantri\/rules-engine$/,
        replacement: path.join(repoRoot, "packages/rules-engine/src/index.ts"),
      },
      {
        find: /^@glantri\/rules-engine\/(.*)$/,
        replacement: path.join(repoRoot, "packages/rules-engine/src/$1"),
      },
      {
        find: /^@glantri\/shared$/,
        replacement: path.join(repoRoot, "packages/shared/src/index.ts"),
      },
      {
        find: /^@glantri\/shared\/(.*)$/,
        replacement: path.join(repoRoot, "packages/shared/src/$1"),
      },
      {
        find: /^@glantri\/test-scenarios$/,
        replacement: path.join(repoRoot, "packages/test-scenarios/src/index.ts"),
      },
      {
        find: /^@glantri\/test-scenarios\/(.*)$/,
        replacement: path.join(repoRoot, "packages/test-scenarios/src/$1"),
      },
    ],
  },
  test: {
    coverage: {
      exclude: [
        "**/.next/**",
        "**/.claude/**",
        "**/coverage/**",
        "**/dist/**",
        "**/node_modules/**",
        "**/*.config.*",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "data/**",
        "packages/content/src/equipment/armorTemplates.ts",
        "packages/content/src/equipment/importedWeaponTemplates.ts",
        "packages/content/src/equipment/shieldTemplates.ts",
      ],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
    },
    environment: "node",
    // Playwright fixtures have their own runner; exclude them from root and package Vitest suites.
    exclude: ["**/.claude/**", "**/node_modules/**", "**/dist/**", "**/browser-tests/**"],
    globals: true,
    maxWorkers: testWorkers,
    // Scale up on demand rather than reserving a full-width pool a small package never uses.
    minWorkers: 1,
  },
});

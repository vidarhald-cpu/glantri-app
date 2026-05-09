import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  resolve: {
    alias: [
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
        find: /^@glantri\/schemas\/(.*)$/,
        replacement: path.join(repoRoot, "packages/schemas/src/$1"),
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
    globals: true,
    environment: "node"
  }
});

import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../packages/config/vitest.base";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: /^@\//,
          replacement: `${path.join(appRoot, "src")}/`
        }
      ]
    },
    test: {
      environmentMatchGlobs: [["**/*.component.test.tsx", "happy-dom"]],
      exclude: ["e2e/**", "**/node_modules/**", "**/dist/**"],
      setupFiles: ["./src/test/setup.ts"]
    }
  })
);

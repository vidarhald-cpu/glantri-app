import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "./packages/config/vitest.base.ts";

// Root coverage uses the Web package's React transform and shared test setup so
// Web tests discovered from the repository root behave like package-local tests.
// Dedicated component tests remain in the Web package's turbo test step.
export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: /^react$/,
          replacement: path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            "apps/web/node_modules/react/index.js",
          ),
        },
        {
          find: /^react\/(.*)$/,
          replacement: path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            "apps/web/node_modules/react/$1",
          ),
        },
        // `react-dom` is a Web-package dependency too, so a bare `react-dom` or
        // `react-dom/server` import in a Web test does not resolve from the repository root the
        // way it does inside the package. Component tests reaching it through
        // `@testing-library/react` resolve from that library's own location and so never hit
        // this; a test importing it directly does. Mirror the `react` aliases above so both
        // kinds behave the same at the root, as this config intends.
        {
          find: /^react-dom$/,
          replacement: path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            "apps/web/node_modules/react-dom/index.js",
          ),
        },
        {
          find: /^react-dom\/(.*)$/,
          replacement: path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            "apps/web/node_modules/react-dom/$1",
          ),
        },
      ],
    },
    test: {
      exclude: ["**/*.component.test.tsx", "**/e2e/**"],
      setupFiles: [fileURLToPath(new URL("./apps/web/src/test/setup.ts", import.meta.url))],
    },
  }),
);

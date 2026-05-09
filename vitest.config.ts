import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "./packages/config/vitest.base";

// Root coverage excludes component tests: they need the React plugin and happy-dom,
// both of which are only configured in apps/web/vitest.config.ts. Component tests
// run via `pnpm --filter @glantri/web test` (turbo test step).
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      exclude: ["**/*.component.test.tsx", "**/e2e/**"],
    },
  }),
);

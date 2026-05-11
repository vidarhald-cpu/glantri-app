import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../packages/config/vitest.base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          branches: 72,
          statements: 64,
        },
      },
    },
  }),
);

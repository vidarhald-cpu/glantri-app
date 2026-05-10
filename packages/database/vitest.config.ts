import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../packages/config/vitest.base";

// Integration tests share a single test database and reset it in beforeEach.
// Disable file parallelism so no two test files touch the database concurrently.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      fileParallelism: false,
    },
  }),
);

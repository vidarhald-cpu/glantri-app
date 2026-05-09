import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../packages/config/vitest.base";

// Integration tests share a single test database and reset it in beforeEach.
// Running files in parallel causes one file's reset to wipe data mid-test in another.
// singleThread forces sequential execution across all test files in this package.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      poolOptions: {
        threads: {
          singleThread: true,
        },
      },
    },
  }),
);

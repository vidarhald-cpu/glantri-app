import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../packages/config/vitest.base";

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [react()],
    test: {
      environmentMatchGlobs: [["**/*.component.test.tsx", "happy-dom"]],
      exclude: ["e2e/**", "**/node_modules/**", "**/dist/**"],
      setupFiles: ["./src/test/setup.ts"]
    }
  })
);

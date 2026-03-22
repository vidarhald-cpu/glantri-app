import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";
import tseslint from "typescript-eslint";

const browserAndNodeGlobals = {
  ...globals.browser,
  ...globals.node
};

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/next-env.d.ts",
      "apps/web/next-env.d.ts",
      "data/raw/workbook/**",
      "data/snapshots/**",
      "data/staging/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: browserAndNodeGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      sourceType: "module"
    },
    rules: {
      "@typescript-eslint/no-empty-object-type": "off"
    }
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs"
    }
  },
  {
    files: ["apps/web/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    plugins: {
      "@next/next": nextPlugin
    },
    settings: {
      next: {
        rootDir: "apps/web/"
      }
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules
    }
  }
);

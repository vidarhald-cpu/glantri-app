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
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true
      }]
    }
  },
  {
    // Production code must not import from test-scenarios
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    ignores: ["**/*.test.ts", "**/*.test.tsx", "**/e2e/**", "**/test-scenarios/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@glantri/test-scenarios", "@glantri/test-scenarios/*"],
            message: "test-scenarios is for tests only. Move shared data to packages/content or packages/domain."
          }
        ]
      }]
    }
  },
  {
    // apps/web must not import directly from @glantri/database
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@glantri/database", "@glantri/database/*"],
            message: "apps/web must not import from @glantri/database. Use domain clients in src/lib/api/ instead."
          }
        ]
      }]
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

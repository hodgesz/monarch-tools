import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Mirror .gitignore: dist/build output and the local-only scratch/debug
    // scripts that are never published are not linted.
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "scripts/check-receipts.ts",
      "scripts/debug-login.ts",
      "scripts/debug-recurring.ts",
      "scripts/debug-upcoming.ts",
      "scripts/explore-api.ts",
      "scripts/explore-warehouse.ts",
      "scripts/extract-token.ts",
      "scripts/sync-monarch.ts",
      "scripts/test-fetchers.ts",
      "scripts/test-refresh.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  }
);

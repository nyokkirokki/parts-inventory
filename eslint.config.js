import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", ".wrangler/**", "coverage/**", "*.config.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Browser (React) code
  {
    files: ["src/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Newer/stricter react-hooks rule surfaced by existing patterns — kept as a warning for now.
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // Worker / Node / tests / scripts
  {
    files: ["src/worker/**/*.ts", "tests/**/*.ts", "scripts/**/*.js", "*.config.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.worker },
    },
  },

  // Project-wide rule tweaks (kept as warnings so the first adoption is not blocking)
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Stricter rule surfaced by existing patterns — kept as a warning for now.
      "no-useless-assignment": "warn",
    },
  },

  prettier,
);

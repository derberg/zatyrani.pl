import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser, // keep browser globals
        ...globals.node,    // add Node.js globals like process, Buffer
      },
      ecmaVersion: 2021,
      sourceType: "module",
    },
    rules: {
      // add custom rules here if needed
    },
  },
  tseslint.configs.recommended,
]);
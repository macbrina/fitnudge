import { nextJsConfig } from "@fitnudge/eslint-config/next-js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...nextJsConfig,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "turbo/no-undeclared-env-vars": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "public/**",
      "*.config.js",
      "*.config.mjs",
    ],
  }
);

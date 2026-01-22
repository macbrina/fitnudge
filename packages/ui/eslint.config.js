import { config } from "@fitnudge/eslint-config/react-internal";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...config,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    ignores: ["node_modules/**", "dist/**"],
  }
);

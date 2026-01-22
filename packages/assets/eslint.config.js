import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
      parserOptions: {
        project: ["./tsconfig.json"], // Path to your tsconfig.json file
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  },
  {
    ignores: ["node_modules/**", "dist/**"],
  }
);

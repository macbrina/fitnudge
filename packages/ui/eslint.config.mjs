import { config } from "@fitnudge/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default {
  ...config,
  rules: {
    ...config.rules,
    "@typescript-eslint/no-explicit-any": "off",
  },
};

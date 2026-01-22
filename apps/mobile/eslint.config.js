import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import prettierPlugin from "eslint-plugin-prettier";
import globals from "globals";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      prettier: prettierPlugin
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
        __DEV__: "readonly"
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        project: ["./tsconfig.json"], // Path to your tsconfig.json file
        tsconfigRootDir: import.meta.dirname
      }
    },
    settings: {
      "import/resolver": {
        typescript: {},
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"]
        }
      },
      react: {
        version: "detect"
      }
    },
    rules: {
      // React Native specific rules
      "no-unused-vars": "off",

      // React rules
      "react/jsx-filename-extension": [1, { extensions: [".tsx", ".ts"] }],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/require-default-props": "off",
      "react/jsx-props-no-spreading": "off",
      "react/function-component-definition": "off",
      "react/no-unstable-nested-components": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "off",
      "react/no-array-index-key": "off",
      "react/no-unescaped-entities": "off",
      "react/style-prop-object": "off",
      "react/prefer-stateless-function": "off",
      "react-native/no-color-literals": "off",
      "react/no-unused-prop-types": "off",
      "react/destructuring-assignment": "off",
      "react/jsx-no-useless-fragment": "off",
      "react/jsx-no-constructed-context-values": "off",

      // TypeScript rules
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/return-await": "off",
      "@typescript-eslint/no-shadow": "off",
      "@typescript-eslint/lines-between-class-members": "off",
      "@typescript-eslint/no-throw-literal": "off",
      "@typescript-eslint/no-require-imports": "off",

      // Import rules
      "import/extensions": "off",
      "no-explicit-any": "off",
      "import/export": "off",
      "import/prefer-default-export": "off",
      "import/no-extraneous-dependencies": "off",
      "import/order": "off",
      "import/no-cycle": "off",
      "import/no-duplicates": "off",
      "import/no-self-import": "off",
      "import/no-relative-packages": "off",
      "import/no-named-as-default": "off",
      "import/no-useless-path-segments": "off",
      "no-else-return": "off",
      "no-plusplus": "off",
      "no-lonely-if": "off",
      "consistent-return": "off",
      "vars-on-top": "off",
      "no-useless-return": "off",
      "prefer-arrow-callback": "off",
      "prefer-destructuring": "off",

      "global-require": "off",
      "max-classes-per-file": "off",
      "no-underscore-dangle": "off",
      "no-nested-ternary": "off",
      "no-param-reassign": "off",
      "no-restricted-syntax": "off",
      "no-await-in-loop": "off",
      "no-continue": "off",
      "arrow-body-style": "off",
      "object-shorthand": "off",

      // General rules
      "no-console": "off",
      "no-debugger": "error",
      "prefer-const": "error",
      "no-var": "off",
      "prefer-template": "off",
      "no-promise-executor-return": "off",
      "class-methods-use-this": "off",
      "no-void": "off",
      "no-empty": "off",
      radix: "off",
      "no-restricted-globals": "off",
      "@typescript-eslint/no-useless-constructor": "off",
      "@typescript-eslint/no-empty-function": "off",
      "no-useless-concat": "off",
      "eslint-comments/no-unused-disable": "off",
      "import/no-mutable-exports": "off",
      "default-case": "off",
      "prefer-exponentiation-operator": "off",
      "no-restricted-properties": "off",

      // Prettier integration
      "prettier/prettier": [
        "error",
        {
          trailingComma: "none",
          singleQuote: false,
          printWidth: 100,
          tabWidth: 2
        }
      ]
    }
  },
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "android/**",
      "ios/**",
      "dist/**",
      "*.config.js",
      "eslint/**/*"
    ]
  }
);

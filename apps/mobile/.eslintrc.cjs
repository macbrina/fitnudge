module.exports = {
  root: true,
  extends: [
    "@react-native-community",
    "airbnb",
    "airbnb-typescript",
    "airbnb/hooks",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2020,
    sourceType: "module",
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [
    "jest.setup.js",
    "*.config.js",
    "eslint/**/*",
    ".eslintrc.cjs",
  ],
  plugins: [
    "@typescript-eslint",
    "react",
    "react-hooks",
    "react-native",
    "import",
    "prettier",
  ],
  rules: {
    // React Native specific rules
    "react-native/no-unused-styles": "off",
    "react-native/split-platform-components": "error",

    "react-native/no-raw-text": "off",
    "react-native/no-single-element-style-arrays": "error",
    "react-native/no-inline-styles": "off",
    "react/jsx-boolean-value": "off",

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
    // Rules renamed/removed in @typescript-eslint v8
    "@typescript-eslint/lines-between-class-members": "off",
    "@typescript-eslint/no-throw-literal": "off",

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
    "radix": "off",
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
    "prettier/prettier": "error",

    // i18n rules - disabled for now, will be implemented later
    // 'local-i18n/no-hardcoded-jsx-strings': [
    //   'warn',
    //   {
    //     checkAttributes: [
    //       'placeholder',
    //       'title',
    //       'accessibilityLabel',
    //       'aria-label',
    //       'alt',
    //       'label',
    //       'headerTitle',
    //       'tabBarLabel',
    //       'buttonText',
    //       'toast',
    //     ],
    //     ignorePatterns: ['^\\s*$', '^https?://', '^[0-9\\s.,:;+\\-/%]+$', '^#[0-9A-Fa-f]{3,8}$'],
    //   },
    // ],
  },
  settings: {
    "import/resolver": {
      typescript: {},
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    },
    react: {
      version: "detect",
    },
  },
  // plugins: {
  //   'local-i18n': require('./eslint/index.js'),
  // },

  env: {
    "react-native/react-native": true,
    es2020: true,
    node: true,
  },
  globals: {
    __DEV__: "readonly",
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      rules: {
        "no-undef": "off",
      },
    },
  ],
};

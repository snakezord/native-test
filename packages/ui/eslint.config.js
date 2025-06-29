import baseConfig from "@vibespeak/eslint-config/base";
import reactConfig from "@vibespeak/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["dist/**"],
  },
  ...baseConfig,
  ...reactConfig,
];

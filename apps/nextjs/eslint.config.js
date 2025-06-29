import baseConfig, { restrictEnvAccess } from "@vibespeak/eslint-config/base";
import nextjsConfig from "@vibespeak/eslint-config/nextjs";
import reactConfig from "@vibespeak/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
];

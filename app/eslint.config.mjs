import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Build & output
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    ".turbo/**",
    // Dependencies
    "node_modules/**",
    // Generated / tooling
    "next-env.d.ts",
    "*.min.js",
    ".cache/**",
    // Test / coverage
    "coverage/**",
    // Non-code content
    "public/**",
    "docs/**",
    "**/docs/**",
    "**/plans/**",
    "**/specs/**",
    "**/assets/**",
    ".worktrees/**",
  ]),
]);

export default eslintConfig;

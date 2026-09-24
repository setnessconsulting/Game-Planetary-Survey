import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Lint is a fast first line of defence for the architecture contract in
 * docs/TECHNICAL_DESIGN.md §2.1. It complements (and does not replace)
 * `scripts/check-architecture.mjs`, which also inspects non-import source
 * patterns such as `runRenderLoop`, `Math.random`, and `Date.now`.
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "node_modules/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
    },
  },
  {
    // The pure domain layer is a leaf module. It may not import any framework,
    // renderer, DOM, or browser API. See docs/TECHNICAL_DESIGN.md §3.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "react/*"], message: "src/domain must stay framework-free (docs/TECHNICAL_DESIGN.md §3)." },
            { group: ["@babylonjs/*"], message: "src/domain must stay renderer-free (docs/TECHNICAL_DESIGN.md §3)." },
            { group: ["@/ui/*", "@/renderer/*", "@/audio/*", "@/content/*", "@/assets/*", "@/platform/*", "@/styles/*"], message: "src/domain is a leaf module and may not import upward (docs/TECHNICAL_DESIGN.md §2.1)." },
          ],
        },
      ],
    },
  },
  {
    // React must not own the 3D frame loop or reach into Babylon directly.
    // The UI talks to the renderer only through its published controller seam.
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@babylonjs/*"], message: "src/ui must not import Babylon; use the renderer seam (docs/TECHNICAL_DESIGN.md §4)." },
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.ts", "*.config.mjs"],
    rules: {
      "no-console": "off",
    },
  },
);

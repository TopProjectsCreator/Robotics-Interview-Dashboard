import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "lib/api-client-react/src/generated/**",
      "lib/api-zod/src/generated/**",
      "artifacts/robotics-interview-dashboard/browser-tests/**",
      "artifacts/robotics-interview-dashboard/public/libarchive/**",
      "**/*.tsbuildinfo",
      ".opencode*/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Shared hygiene rules; tsc catches undefined names and real type errors.
      // The base rule misfires on TS declaration merging; use the TS-aware one.
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",
      // `a && b()` / ternary statements are used idiomatically here.
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-useless-assignment": "warn",
      "no-useless-escape": "warn",
      "no-control-regex": "warn",
      "no-useless-catch": "warn",
      // Useful hygiene signal, but too noisy as a hard error on this codebase.
      "preserve-caught-error": "warn",
      // `while (true)` with a break condition is used intentionally.
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      // tsc already catches undefined names; the base rule misfires on types.
      "no-undef": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // Classic hooks rules only; the v7 "recommended" set enables the React
      // Compiler advisory rules, which flag idiomatic pre-existing code.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["artifacts/robotics-interview-dashboard/src/**/*.{ts,tsx}", "lib/object-storage-web/src/**/*.tsx"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ["lib/integrations-openai-ai-react/src/audio/audio-playback-worklet.js"],
    languageOptions: {
      globals: {
        AudioWorkletProcessor: "readonly",
        registerProcessor: "readonly",
        sampleRate: "readonly",
        currentFrame: "readonly",
        currentTime: "readonly",
        console: "readonly",
      },
    },
  },
  {
    files: ["**/*.{mjs,cjs,js}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.venv/**",
      "reports/**",
      "build/**",
      "apps/api/**",
      "research/python/**",
      "tools/ci/fixtures/**",
      "apps/web/public/mediapipe/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: { process: "readonly", module: "writable", console: "readonly", fetch: "readonly" },
    },
  },
  {
    // Núcleo puro: el reloj, los temporizadores y el azar se inyectan, nunca se leen del entorno.
    files: ["packages/core/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "Inyecta el reloj en lugar de usar Date." },
        { name: "performance", message: "Inyecta el reloj en lugar de usar performance." },
        { name: "setTimeout", message: "El núcleo no usa temporizadores." },
        { name: "setInterval", message: "El núcleo no usa temporizadores." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Inyecta un generador con semilla." },
      ],
    },
  },
);

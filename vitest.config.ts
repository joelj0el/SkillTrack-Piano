import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // La mitad de los núcleos: con uno por núcleo, bajo carga los workers no alcanzan a arrancar.
    maxWorkers: "50%",
    // La tabla de la terminal también lista los archivos con cobertura completa.
    coverage: { provider: "v8", reporter: [["text", { skipFull: false }]] },
    projects: [
      {
        test: {
          name: "node",
          include: [
            "tools/**/*.test.ts",
            "packages/*/src/**/*.test.ts",
            "research/node/src/**/*.test.ts",
            "infra/**/*.test.ts",
          ],
          exclude: [...configDefaults.exclude, "tools/ci/fixtures/**", "tools/docs/fixtures/**"],
        },
      },
      "apps/web",
    ],
  },
});

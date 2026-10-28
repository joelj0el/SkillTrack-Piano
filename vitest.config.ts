import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
          exclude: [...configDefaults.exclude, "tools/ci/fixtures/**"],
        },
      },
      "apps/web",
    ],
  },
});

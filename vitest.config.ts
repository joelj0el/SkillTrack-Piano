import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          include: ["tools/**/*.test.ts", "packages/*/src/**/*.test.ts", "infra/**/*.test.ts"],
        },
      },
      "apps/web",
    ],
  },
});

import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { opcionesPwa } from "./src/pwa.ts";

export default defineConfig({
  plugins: [react(), VitePWA(opcionesPwa)],
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

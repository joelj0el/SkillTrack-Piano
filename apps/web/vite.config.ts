import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { opcionesPwa } from "./src/pwa.ts";

export default defineConfig({
  plugins: [react(), VitePWA(opcionesPwa)],
  // Solo desarrollo (`pnpm dev`): la API es la del sistema levantado con docker compose. Sirve
  // para probar en un teléfono por USB con chrome://inspect (http://localhost es contexto seguro).
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "https://localhost", changeOrigin: true, secure: false } },
  },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

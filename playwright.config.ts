import { defineConfig, devices } from "@playwright/test";

// Pruebas E2E contra el sistema completo levantado con docker compose (https://localhost).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["junit", { outputFile: "reports/e2e.xml" }]],
  use: {
    baseURL: process.env.E2E_URL ?? "https://localhost",
    ignoreHTTPSErrors: true,
    locale: "es-BO",
    timezoneId: "America/La_Paz",
    trace: "retain-on-failure",
    // El certificado local lo firma la CA interna de Caddy: sin esta opción Chromium no registra
    // el service worker (ignoreHTTPSErrors no alcanza a la descarga del script del worker).
    launchOptions: { args: ["--ignore-certificate-errors"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],
});

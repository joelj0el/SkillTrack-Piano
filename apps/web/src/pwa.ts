import type { VitePWAOptions } from "vite-plugin-pwa";

export const opcionesPwa = {
  registerType: "autoUpdate",
  // Registro como archivo externo: la CSP no admite scripts en línea.
  injectRegister: "script",
  includeAssets: ["icono.svg", "iconos/*.png"],
  manifest: {
    name: "SkillTrack-Piano",
    short_name: "SkillTrack",
    description: "Análisis y seguimiento de estudiantes principiantes de piano",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Íconos provisionales (node tools/iconos.mjs); los definitivos vienen del sistema de diseño.
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icono.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  },
  workbox: {
    navigateFallbackDenylist: [/^\/api\//],
    // El detector (WASM y modelo, decenas de MB) se descarga al usar la cámara, no al instalar.
    globIgnores: ["**/mediapipe/**"],
  },
} satisfies Partial<VitePWAOptions>;

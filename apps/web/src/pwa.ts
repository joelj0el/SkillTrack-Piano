import type { VitePWAOptions } from "vite-plugin-pwa";

export const opcionesPwa = {
  registerType: "autoUpdate",
  // Registro como archivo externo: la CSP no admite scripts en línea.
  injectRegister: "script",
  includeAssets: ["icono.svg"],
  manifest: {
    name: "SkillTrack-Piano",
    short_name: "SkillTrack",
    description: "Análisis y seguimiento de estudiantes principiantes de piano",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Ícono provisional: los PNG definitivos se generan con el sistema de diseño.
    icons: [{ src: "/icono.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  },
  workbox: {
    navigateFallbackDenylist: [/^\/api\//],
  },
} satisfies Partial<VitePWAOptions>;

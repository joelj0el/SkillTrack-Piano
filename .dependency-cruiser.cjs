// Reglas de dependencias entre paquetes: núcleo puro, contratos como hoja y sin ciclos.
/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "nucleo-puro",
      comment: "El código del núcleo solo depende de sí mismo, de los contratos y de zod.",
      severity: "error",
      from: { path: "^packages/core/", pathNot: "\\.test\\.ts$" },
      to: { pathNot: ["^packages/(core|contracts)/", "node_modules/zod/"] },
    },
    {
      name: "nucleo-pruebas",
      comment: "Las pruebas del núcleo pueden usar además vitest y fast-check.",
      severity: "error",
      from: { path: "^packages/core/.+\\.test\\.ts$" },
      to: {
        pathNot: [
          "^packages/(core|contracts)/",
          "node_modules/(zod|vitest|@vitest/[^/]+|fast-check)/",
        ],
      },
    },
    {
      name: "contratos-hoja",
      comment: "Los contratos no dependen del núcleo, de las aplicaciones ni de la investigación.",
      severity: "error",
      from: { path: "^packages/contracts/" },
      to: { path: "^(packages/core|apps|research)/" },
    },
    {
      name: "web-sin-investigacion",
      severity: "error",
      from: { path: "^apps/web/" },
      to: { path: "^research/" },
    },
    {
      name: "research-sin-apps",
      comment: "La investigación usa el núcleo y los contratos, nunca las aplicaciones.",
      severity: "error",
      from: { path: "^research/" },
      to: { path: "^apps/" },
    },
    {
      name: "sin-ciclos",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)dist/" },
    tsPreCompilationDeps: true,
  },
};

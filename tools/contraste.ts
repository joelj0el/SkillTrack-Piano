// Verifica el contraste WCAG 2.2 AA de cada par de colores de los tokens, en claro y en oscuro.
// Uso: pnpm design:contraste
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface Par {
  texto: string;
  fondo: string;
  minimo: number;
}

export type Temas = Record<"claro" | "oscuro", Record<string, string>>;

export interface Fallo {
  tema: keyof Temas;
  texto: string;
  fondo: string;
  razon: number;
  minimo: number;
}

const TEXTO = 4.5;
const COMPONENTE = 3;

const textoSobre = (texto: string, fondos: string[]): Par[] =>
  fondos.map((fondo) => ({ texto, fondo, minimo: TEXTO }));
const componenteSobre = (texto: string, fondos: string[]): Par[] =>
  fondos.map((fondo) => ({ texto, fondo, minimo: COMPONENTE }));

const SUPERFICIES = ["--color-fondo", "--color-superficie", "--color-superficie-2"];
const FAMILIAS = ["correcto", "nota", "tiempo", "mano", "no-evaluable"];

export const PARES: Par[] = [
  ...textoSobre("--color-texto", SUPERFICIES),
  ...textoSobre("--color-texto-suave", SUPERFICIES),
  ...textoSobre("--color-enlace", SUPERFICIES),
  ...textoSobre("--color-peligro", SUPERFICIES),
  ...textoSobre("--color-sobre-acento", ["--color-acento", "--color-acento-pulsado"]),
  ...textoSobre("--color-sobre-peligro", ["--color-peligro"]),
  ...textoSobre("--color-aviso-texto", ["--color-aviso-fondo"]),
  ...textoSobre("--color-texto-sobre-video", ["--color-velo-video"]),
  ...FAMILIAS.flatMap((f) => [
    ...textoSobre(`--color-${f}`, [`--color-${f}-fondo`]),
    ...textoSobre(`--color-${f}`, ["--color-superficie"]),
  ]),
  ...componenteSobre("--color-borde-control", SUPERFICIES),
  ...componenteSobre("--color-acento", SUPERFICIES),
  ...componenteSobre("--color-foco", SUPERFICIES),
  ...componenteSobre("--color-tecla-negra", ["--color-tecla-blanca"]),
  ...componenteSobre("--color-tecla-activa", ["--color-tecla-negra", "--color-superficie"]),
];

function canal(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function razon(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

function bloque(css: string, selector: string): Record<string, string> {
  const inicio = css.indexOf(`${selector} {`);
  if (inicio < 0) throw new Error(`No existe el bloque ${selector}`);
  const cuerpo = css.slice(inicio, css.indexOf("}", inicio));
  return Object.fromEntries(
    [...cuerpo.matchAll(/(--color-[a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1]!, m[2]!]),
  );
}

/** El tema oscuro hereda del claro lo que no redefine. */
export function leerTemas(css: string): Temas {
  const claro = bloque(css, ":root");
  return { claro, oscuro: { ...claro, ...bloque(css, ':root[data-tema="oscuro"]') } };
}

export function verificar(temas: Temas): Fallo[] {
  const fallos: Fallo[] = [];
  for (const tema of ["claro", "oscuro"] as const) {
    for (const { texto, fondo, minimo } of PARES) {
      const [a, b] = [temas[tema][texto], temas[tema][fondo]];
      const valor = a && b ? razon(a, b) : 0;
      if (valor < minimo) fallos.push({ tema, texto, fondo, razon: valor, minimo });
    }
  }
  return fallos;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const ruta = resolve(import.meta.dirname, "../apps/web/src/design/tokens.css");
  const fallos = verificar(leerTemas(readFileSync(ruta, "utf8")));
  for (const f of fallos) {
    console.error(
      `${f.tema}: ${f.texto} sobre ${f.fondo} = ${f.razon.toFixed(2)} (mínimo ${f.minimo})`,
    );
  }
  console.log(
    fallos.length
      ? `${fallos.length} pares no cumplen.`
      : `Los ${PARES.length} pares cumplen en claro y en oscuro.`,
  );
  process.exitCode = fallos.length ? 1 : 0;
}

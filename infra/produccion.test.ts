import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const leer = (archivo: string) => readFileSync(new URL(archivo, import.meta.url), "utf8");
const local = leer("./Caddyfile");
const produccion = leer("./Caddyfile.prod");
const compose = leer("./docker-compose.prod.yml");

/** Bloque del sitio sin comentarios: cabeceras y rutas. */
function sitio(caddyfile: string, direccion: string): string {
  const inicio = caddyfile.indexOf(`${direccion} {`);
  return caddyfile
    .slice(inicio + direccion.length)
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n")
    .trim();
}

/** Servicios de primer nivel del compose y el texto de cada uno. */
function servicios(texto: string): Record<string, string> {
  const bloque = texto.slice(texto.indexOf("services:"), texto.indexOf("\nvolumes:"));
  const partes = bloque.split(/\n {2}(?=[a-z]+:\n)/).slice(1);
  return Object.fromEntries(partes.map((p) => [p.slice(0, p.indexOf(":")), p]));
}

describe("producción", () => {
  it("PU-infra-05: el Caddyfile de producción tiene las mismas cabeceras y rutas que el local", () => {
    expect(sitio(produccion, "{$DOMINIO}")).toBe(sitio(local, "{$DOMINIO:localhost}"));
  });

  it("PU-infra-06: producción usa un certificado público para su dominio, sin valor por omisión", () => {
    expect(produccion).toMatch(/^\s*email \{\$CORREO_ACME\}$/m);
    expect(produccion).toMatch(/^\{\$DOMINIO\} \{$/m);
    expect(produccion).not.toMatch(/tls internal|local_certs|default_sni|\{\$DOMINIO:/);
  });

  it("PU-infra-07: el compose de producción no tiene base de datos, ni construcción, ni semilla", () => {
    const s = servicios(compose);
    expect(Object.keys(s).sort()).toEqual(["api", "web"]);
    expect(compose).not.toMatch(/\bbuild:|SEMILLA|postgres:/);
    // Solo Caddy publica puertos: la API queda dentro de la red de Docker.
    expect(s.api).not.toMatch(/ports:/);
    expect(s.web).toMatch(/- "443:443"/);
  });

  it("PU-infra-08: las imágenes se toman por el commit y la configuración no tiene valores por omisión", () => {
    const s = servicios(compose);
    expect(s.api).toContain("image: ghcr.io/${IMAGENES:?}/api:${ETIQUETA:?}");
    expect(s.web).toContain("image: ghcr.io/${IMAGENES:?}/web:${ETIQUETA:?}");
    expect(s.api).toContain("DATABASE_URL: ${DATABASE_URL:?}");
    expect(s.web).toContain("./Caddyfile.prod:/etc/caddy/Caddyfile:ro");
    // Las migraciones no se aplican al arrancar: las aplica el despliegue, una vez.
    expect(s.api).not.toMatch(/alembic/);
  });
});

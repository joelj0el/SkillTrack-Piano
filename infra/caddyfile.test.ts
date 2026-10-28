import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const caddyfile = readFileSync(new URL("./Caddyfile", import.meta.url), "utf8");

function directivaCsp(nombre: string): string[] {
  const csp = /Content-Security-Policy\s+"([^"]+)"/.exec(caddyfile)?.[1] ?? "";
  const directiva = csp
    .split(";")
    .map((parte) => parte.trim().split(/\s+/))
    .find(([clave]) => clave === nombre);
  return directiva?.slice(1) ?? [];
}

describe("Caddyfile", () => {
  it("PU-infra-01: la CSP limita las conexiones al mismo origen", () => {
    expect(directivaCsp("connect-src")).toEqual(["'self'"]);
    expect(directivaCsp("default-src")).toEqual(["'self'"]);
    expect(directivaCsp("default-src")).not.toContain("*");
    expect(directivaCsp("script-src")).not.toContain("'unsafe-inline'");
    expect(directivaCsp("script-src")).not.toContain("'unsafe-eval'");
  });

  it("PU-infra-03: todas las respuestas llevan HSTS, Permissions-Policy y Referrer-Policy", () => {
    expect(caddyfile).toMatch(/Strict-Transport-Security "max-age=\d+"/);
    expect(caddyfile).toContain('Permissions-Policy "camera=(self), microphone=(self)"');
    expect(caddyfile).toMatch(/Referrer-Policy "no-referrer"/);
  });

  it("PU-infra-02: /api se reenvía a la API y el resto cae en index.html", () => {
    expect(caddyfile).toMatch(/handle \/api\/\*\s*\{\s*reverse_proxy api:8000\s*\}/);
    expect(caddyfile).toMatch(/try_files \{path\} \/index\.html/);
  });
});

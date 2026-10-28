import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizarLf } from "./normalizar-lf.ts";

describe("normalización de finales de línea", () => {
  it("PU-contracts-04: los modelos generados quedan con LF aunque la herramienta escriba CRLF", () => {
    const carpeta = mkdtempSync(join(tmpdir(), "lf-"));
    writeFileSync(join(carpeta, "salud.py"), "a\r\nb\r\n");
    writeFileSync(join(carpeta, "ya.py"), "c\n");

    normalizarLf(carpeta);

    expect(readFileSync(join(carpeta, "salud.py"), "utf8")).toBe("a\nb\n");
    expect(readFileSync(join(carpeta, "ya.py"), "utf8")).toBe("c\n");
  });
});

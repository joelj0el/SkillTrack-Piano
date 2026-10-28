import { afterEach, describe, expect, it } from "vitest";
import { aplicarTema, temaGuardado } from "./tema.ts";

afterEach(() => localStorage.clear());

describe("tema", () => {
  it("PU-web-13: el tema claro es el predeterminado y el elegido se recuerda", () => {
    expect(temaGuardado()).toBe("claro");
    aplicarTema("oscuro");
    expect(document.documentElement.dataset.tema).toBe("oscuro");
    expect(temaGuardado()).toBe("oscuro");
  });
});

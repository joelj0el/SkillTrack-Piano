/** Tema claro (predeterminado) u oscuro; la preferencia se recuerda en este navegador. */
export type Tema = "claro" | "oscuro";

const CLAVE = "skilltrack.tema";

export function temaGuardado(): Tema {
  try {
    return localStorage.getItem(CLAVE) === "oscuro" ? "oscuro" : "claro";
  } catch {
    return "claro";
  }
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin almacenamiento (navegación privada): el tema vale solo para esta visita.
  }
}

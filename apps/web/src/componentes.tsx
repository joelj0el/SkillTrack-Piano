import { useCallback, useEffect, useState, type DependencyList, type ReactNode } from "react";
import { SinConexion as ErrorSinConexion, ErrorApi } from "./api.ts";

/** P-05: secciones que necesitan el servidor cuando no hay red. */
export function SinConexion() {
  return (
    <section aria-labelledby="titulo-sin-conexion">
      <h1 id="titulo-sin-conexion">Sin conexión</h1>
      <p>
        No pudimos comunicarnos con el servidor. Revisa tu conexión a internet; esta sección se
        actualizará cuando vuelvas a tener red.
      </p>
    </section>
  );
}

export function NoEncontrado({ texto = "No encontramos lo que buscabas." }: { texto?: string }) {
  return (
    <section>
      <h1>No encontrado</h1>
      <p>{texto}</p>
    </section>
  );
}

type Carga<T> =
  | { tipo: "cargando" }
  | { tipo: "listo"; datos: T }
  | { tipo: "sin-conexion" }
  | { tipo: "error"; error: ErrorApi };

export function useCarga<T>(cargar: () => Promise<T>, deps: DependencyList) {
  const [carga, setCarga] = useState<Carga<T>>({ tipo: "cargando" });
  const ejecutar = useCallback(cargar, deps);

  const recargar = useCallback(async () => {
    try {
      setCarga({ tipo: "listo", datos: await ejecutar() });
    } catch (error) {
      if (error instanceof ErrorSinConexion) setCarga({ tipo: "sin-conexion" });
      else if (error instanceof ErrorApi) setCarga({ tipo: "error", error });
      else throw error;
    }
  }, [ejecutar]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { carga, recargar };
}

/** Muestra el estado de una carga y delega en `children` cuando hay datos. */
export function Cargado<T>({
  carga,
  children,
}: {
  carga: Carga<T>;
  children: (datos: T) => ReactNode;
}) {
  switch (carga.tipo) {
    case "cargando":
      return <p className="suave">Cargando…</p>;
    case "sin-conexion":
      return <SinConexion />;
    case "error":
      return carga.error.estado === 404 ? (
        <NoEncontrado />
      ) : (
        <p className="error" role="alert">
          {carga.error.message}
        </p>
      );
    case "listo":
      return <>{children(carga.datos)}</>;
  }
}

export const NOMBRE_MANOS = { MI: "Mano izquierda", MD: "Mano derecha", juntas: "Manos juntas" };

export function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

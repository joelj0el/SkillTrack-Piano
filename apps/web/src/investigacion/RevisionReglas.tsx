import { Ejercicio } from "@skilltrack/contracts";
import { diagnosticar } from "@skilltrack/core";
import { useState } from "react";
import { pedir } from "../api.ts";
import { artefactosVigentes } from "../captura/artefactos.ts";
import { Cargado, useCarga } from "../componentes.tsx";
import { INTENTO_EJEMPLO } from "./ejemplo.ts";

type Modo = "V" | "A" | "VA";
const NOMBRE_MODO: Record<Modo, string> = {
  V: "Solo visión (V)",
  A: "Solo audio (A)",
  VA: "Visión y audio (VA)",
};
const NOMBRE_ESTADO = {
  detectado: "Detectado",
  "sin-error": "Sin error",
  "no-evaluable": "No evaluable",
} as const;

/** HU-23: qué regla disparó cada diagnóstico, y con qué eventos, sobre un intento de ejemplo. */
export function RevisionReglas() {
  const [modo, setModo] = useState<Modo>("VA");
  const { carga } = useCarga(async () => {
    const ejercicio = await pedir(
      "GET",
      `/catalogo/ejercicios/${INTENTO_EJEMPLO.ejercicio}`,
      Ejercicio,
    );
    return artefactosVigentes(ejercicio.version_vigente.id);
  }, []);

  return (
    <section aria-labelledby="titulo-revision">
      <h2 id="titulo-revision">Revisión de bandas y reglas</h2>
      <p className="suave">{INTENTO_EJEMPLO.descripcion}</p>
      <Cargado carga={carga}>
        {({ referencia, reglas }) => {
          if (!reglas) return <p className="aviso">Todavía no hay reglas publicadas.</p>;
          const r = diagnosticar({
            eventos: INTENTO_EJEMPLO.eventos,
            cambioTempoPct: INTENTO_EJEMPLO.cambio_tempo_pct,
            referencia: referencia
              ? { version: referencia.referencia.version, bandas: referencia.referencia.bandas }
              : null,
            reglas: reglas.conjunto,
            modo,
          });
          return (
            <div data-modo={r.modo}>
              <div className="fila">
                <label>
                  Modo
                  <select value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
                    {(Object.keys(NOMBRE_MODO) as Modo[]).map((m) => (
                      <option key={m} value={m}>
                        {NOMBRE_MODO[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="metadato">
                Reglas v{r.version_reglas} · referencia{" "}
                {r.version_referencia === null ? "sin publicar" : `v${r.version_referencia}`} · modo{" "}
                {r.modo}
              </p>
              <div className="tabla-contenedor">
                <table className="tabla" aria-label="Diagnósticos">
                  <thead>
                    <tr>
                      <th>Indicador</th>
                      <th>Clase</th>
                      <th>Regla</th>
                      <th>Eventos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.diagnosticos.length === 0 && (
                      <tr>
                        <td colSpan={4}>Ningún diagnóstico</td>
                      </tr>
                    )}
                    {r.diagnosticos.map((d) => (
                      <tr key={d.regla} data-regla={d.regla} data-indicador={d.indicador}>
                        <td>{d.indicador}</td>
                        <td>{d.clase}</td>
                        <td>{d.regla}</td>
                        <td>{d.eventos.length ? d.eventos.join(", ") : "Todo el intento"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tabla-contenedor">
                <table className="tabla" aria-label="Indicadores">
                  <thead>
                    <tr>
                      <th>Indicador</th>
                      <th>Estado</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(r.indicadores).map(([codigo, e]) => (
                      <tr key={codigo} data-indicador={codigo} data-estado={e.estado}>
                        <td>{codigo}</td>
                        <td>{NOMBRE_ESTADO[e.estado]}</td>
                        <td>{e.motivo ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }}
      </Cargado>
    </section>
  );
}

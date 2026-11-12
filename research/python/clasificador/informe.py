"""Métricas e informe V3c en Markdown: tal como salen, separadas por origen y con avisos de G-2."""

from collections import defaultdict
from dataclasses import dataclass

from clasificador.pipeline import ESCENARIOS, MODOS, Condicion, Prediccion, Resultado


@dataclass
class Metricas:
    n: int
    tp: int
    fp: int
    fn: int
    tn: int

    @property
    def exhaustividad(self) -> float | None:
        return self.tp / (self.tp + self.fn) if self.tp + self.fn else None

    @property
    def f1(self) -> float | None:
        d = 2 * self.tp + self.fp + self.fn
        return 2 * self.tp / d if d else None

    @property
    def kappa(self) -> float | None:
        if not self.n:
            return None
        acuerdo = (self.tp + self.tn) / self.n
        p_real = (self.tp + self.fn) / self.n
        p_pred = (self.tp + self.fp) / self.n
        esperado = p_real * p_pred + (1 - p_real) * (1 - p_pred)
        return None if esperado == 1 else (acuerdo - esperado) / (1 - esperado)


def metricas(predicciones: list[Prediccion]) -> Metricas:
    c = defaultdict(int)
    for p in predicciones:
        c[(p.real, p.predicha)] += 1
    return Metricas(len(predicciones), c[(1, 1)], c[(0, 1)], c[(1, 0)], c[(0, 0)])


def agrupar(res: Resultado) -> dict[tuple, Metricas]:
    """(escenario, modo, modelo, origen, clase) → métricas sobre las filas de prueba."""
    grupos: dict[tuple, list[Prediccion]] = defaultdict(list)
    for p in res.predicciones:
        grupos[(p.escenario, p.modo, p.modelo, p.origen, p.clase)].append(p)
    return {k: metricas(v) for k, v in grupos.items()}


def f1_macro(tabla: dict[tuple, Metricas], escenario, modo, modelo, origen, clases) -> float | None:
    valores = [
        m.f1
        for c in clases
        if (m := tabla.get((escenario, modo, modelo, origen, c))) and m.f1 is not None
    ]
    return sum(valores) / len(valores) if valores else None


def _n(x: float | None, pct: bool = False) -> str:
    if x is None:
        return "—"
    return f"{100 * x:.1f} %" if pct else f"{x:.2f}"


def mejor_modelo(tabla, clases) -> tuple[str, str, float | None, float | None]:
    """Mejor modelo entrenado (F1 macro en filas reales, modo VA) y las reglas en su escenario."""
    candidatos = [
        (f1_macro(tabla, e, "VA", m, "real", clases) or -1.0, e, m)
        for e in ESCENARIOS
        for m in ("logistica", "arbol")
    ]
    f1, escenario, nombre = max(candidatos)
    reglas = f1_macro(tabla, escenario, "VA", "reglas", "real", clases)
    return escenario, nombre, (None if f1 < 0 else f1), reglas


def informe(
    res: Resultado,
    condiciones: list[Condicion],
    clases: list[str],
    excluidas: dict[str, int],
    datos: dict,
) -> str:
    tabla = agrupar(res)
    lineas: list[str] = ["# V3c · Clasificador frente a las reglas congeladas", ""]
    lineas += [
        f"- Dataset: sha256 `{datos['dataset_sha256']}` ({datos['filas']} filas: "
        + ", ".join(f"{o} {n}" for o, n in datos["filas_por_origen"].items())
        + ").",
        f"- Protocolo congelado: sha256 `{datos['protocolo_sha256']}`.",
        f"- Semilla: {datos['semilla']}.",
        "",
    ]
    fallan = [c for c in condiciones if not c.cumple]
    lineas += ["## Suficiencia de datos (G-2, filas reales)", ""]
    if fallan:
        lineas += [
            f"> **Aviso: no se cumple G-2** ({len(fallan)} de {len(condiciones)} condiciones). "
            "Los resultados son exploratorios y no se pueden generalizar.",
            "",
        ]
    lineas += ["| Condición | Valor | Umbral | Cumple |", "| --- | --- | --- | --- |"]
    for c in condiciones:
        es_pct = c.nombre == "Tomas válidas"
        valor = _n(c.valor, es_pct) if not isinstance(c.valor, int) else str(c.valor)
        umbral = _n(c.umbral, es_pct) if isinstance(c.umbral, float) else str(c.umbral)
        lineas.append(f"| {c.nombre} | {valor} | {umbral} | {'sí' if c.cumple else 'no'} |")
    lineas.append("")
    lineas += ["## Clases (DP-06)", ""]
    lineas.append(f"Incluidas: {', '.join(clases) or 'ninguna'}.")
    for clase, n in excluidas.items():
        lineas.append(f"- {clase} excluida: {n} sujetos reales con la clase (< 8).")
    lineas.append("")
    lineas += [
        "## Partición por sujeto",
        "",
        f"Pliegues: {res.pliegues} · sujetos compartidos entre entrenamiento y prueba: "
        f"{res.sujetos_compartidos}.",
    ]
    for k, motivo in res.sin_evaluar.items():
        lineas.append(f"- Sin evaluar {k}: {motivo}.")
    lineas.append("")
    lineas += ["## Resultados (modo VA), por origen de las filas de prueba", ""]
    cab = " | ".join(f"Exhaustividad {c}" for c in clases)
    lineas += [
        f"| Escenario | Modelo | Origen de prueba | F1 macro | {cab} |",
        "| --- | --- | --- | --- | " + " | ".join("---" for _ in clases) + " |",
    ]
    for e in ESCENARIOS:
        for m in ("logistica", "arbol", "mayoritaria", "reglas"):
            for o in ("real", "actuado", "sintetico"):
                if not any((e, "VA", m, o, c) in tabla for c in clases):
                    continue
                recalls = " | ".join(
                    _n(tabla[(e, "VA", m, o, c)].exhaustividad, True)
                    if (e, "VA", m, o, c) in tabla
                    else "—"
                    for c in clases
                )
                f1 = _n(f1_macro(tabla, e, "VA", m, o, clases))
                lineas.append(f"| {e} | {m} | {o} | {f1} | {recalls} |")
    lineas.append("")
    lineas += ["## Matrices de confusión (solo reales, modo VA, filas reales de prueba)", ""]
    lineas += [
        "| Modelo | Clase | VP | FP | FN | VN | κ frente al consenso |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for m in ("logistica", "arbol", "mayoritaria", "reglas"):
        for c in clases:
            x = tabla.get(("solo_reales", "VA", m, "real", c))
            if x:
                lineas.append(f"| {m} | {c} | {x.tp} | {x.fp} | {x.fn} | {x.tn} | {_n(x.kappa)} |")
    lineas.append("")
    lineas += ["## Techo: κ entre etiquetadores (filas reales)", ""]
    for c in condiciones:
        if c.nombre.startswith("κ entre etiquetadores"):
            lineas.append(f"- {c.nombre.removeprefix('κ entre etiquetadores ')}: {_n(c.valor)}")
    lineas.append("")
    lineas += ["## Ablación V / A / VA (F1 macro en filas reales de prueba)", ""]
    lineas += ["| Escenario | Modelo | V | A | VA |", "| --- | --- | --- | --- | --- |"]
    for e in ESCENARIOS:
        for m in ("logistica", "arbol"):
            celdas = " | ".join(_n(f1_macro(tabla, e, modo, m, "real", clases)) for modo in MODOS)
            lineas.append(f"| {e} | {m} | {celdas} |")
    lineas.append("")
    escenario, nombre, f1, reglas = mejor_modelo(tabla, clases)
    supera = f1 is not None and reglas is not None and f1 > reglas
    lineas += [
        "## Exportación",
        "",
        f"Mejor modelo: {nombre} ({escenario}), F1 macro {_n(f1)}; "
        f"reglas congeladas: {_n(reglas)}. "
        + (
            "Supera a las reglas: se exporta a ONNX."
            if supera
            else "No supera a las reglas: no se exporta (resultado negativo)."
        ),
    ]
    return "\n".join(lineas).rstrip() + "\n"

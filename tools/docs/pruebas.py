# /// script
# requires-python = "==3.12.*"
# dependencies = []
# ///
"""docs:tests it-N — genera n6-pruebas.generado.md desde los reportes JUnit reales.

Versión mínima: lee reports/**/*.xml (Vitest, pytest y Playwright), extrae el ID de cada
prueba y escribe la tabla de PA, el resumen de PU por módulo y los totales. No inventa
resultados: si un reporte no existe, la prueba no aparece.

Uso: pnpm docs:tests it-N [--reportes DIR] [--salida ARCHIVO] [--historias HU-01,HU-14]
"""

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

# La consola de Windows no usa UTF-8 por defecto.
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

RAIZ = Path(__file__).resolve().parents[2]
ID_TS = re.compile(r"\b(PA-HU\d{2}-\d{2}|P[UP]-[a-z]+-\d{2})\b")
ID_PY = re.compile(r"test_(pa)_hu(\d{2})_(\d{2})|test_(pu|pp)_([a-z]+)_(\d{2})")


@dataclass(frozen=True)
class Resultado:
    id: str
    nombre: str
    herramienta: str
    estado: str  # aprobada | fallida | omitida


def extraer_id(nombre: str) -> str | None:
    if m := ID_TS.search(nombre):
        return m.group(1)
    if m := ID_PY.search(nombre):
        if m.group(1):
            return f"PA-HU{m.group(2)}-{m.group(3)}"
        return f"{m.group(4).upper()}-{m.group(5)}-{m.group(6)}"
    return None


def herramienta_de(archivo: Path) -> str:
    nombre = archivo.stem.lower()
    if "pytest" in nombre:
        return "pytest"
    if "e2e" in nombre or "playwright" in nombre:
        return "Playwright"
    return "Vitest"


def leer(reportes: Path) -> list[Resultado]:
    resultados: list[Resultado] = []
    for archivo in sorted(reportes.rglob("*.xml")):
        herramienta = herramienta_de(archivo)
        for caso in ET.parse(archivo).getroot().iter("testcase"):
            nombre = caso.get("name", "")
            identificador = extraer_id(nombre)
            if identificador is None:
                continue
            if caso.find("failure") is not None or caso.find("error") is not None:
                estado = "fallida"
            elif caso.find("skipped") is not None:
                estado = "omitida"
            else:
                estado = "aprobada"
            resultados.append(Resultado(identificador, nombre, herramienta, estado))
    return resultados


def agrupar(resultados: list[Resultado]) -> dict[str, dict]:
    """Una fila por ID: un ID con varios casos (parametrizados) solo aprueba si todos aprueban."""
    filas: dict[str, dict] = {}
    for r in resultados:
        fila = filas.setdefault(
            r.id, {"nombre": r.nombre, "herramientas": set(), "estados": []}
        )
        fila["herramientas"].add(r.herramienta)
        fila["estados"].append(r.estado)
    for fila in filas.values():
        estados = fila["estados"]
        fila["estado"] = (
            "fallida"
            if "fallida" in estados
            else "omitida"
            if "omitida" in estados
            else "aprobada"
        )
        fila["casos"] = len(estados)
        fila["herramienta"] = " + ".join(sorted(fila["herramientas"]))
    return filas


def generar(
    iteracion: str,
    resultados: list[Resultado],
    historias: set[str] | None,
    instante: datetime,
) -> str:
    filas = agrupar(resultados)
    pa = {
        k: v
        for k, v in sorted(filas.items())
        if k.startswith("PA-") and (not historias or k[3:7] in historias)
    }
    pu = {k: v for k, v in filas.items() if not k.startswith("PA-")}
    lineas = [
        f"# n.6 Pruebas — {iteracion} (generado)",
        "",
        (
            f"Generado por `pnpm docs:tests {iteracion}` el {instante:%Y-%m-%d %H:%M} UTC a "
            "partir de los reportes JUnit de `reports/`. No se edita a mano."
        ),
        "",
        "## Totales por herramienta",
        "",
        "| Herramienta | Casos | Aprobados | Fallidos | Omitidos |",
        "|---|---|---|---|---|",
    ]
    por_herramienta: dict[str, list[str]] = defaultdict(list)
    for r in resultados:
        por_herramienta[r.herramienta].append(r.estado)
    for herramienta, estados in sorted(por_herramienta.items()):
        lineas.append(
            f"| {herramienta} | {len(estados)} | {estados.count('aprobada')} | "
            f"{estados.count('fallida')} | {estados.count('omitida')} |"
        )
    lineas += [
        "",
        "## Pruebas de aceptación (PA)",
        "",
        "| PA | Herramienta | Casos | Resultado | Prueba |",
        "|---|---|---|---|---|",
    ]
    for identificador, fila in pa.items():
        nombre = fila["nombre"].replace("|", "\\|")
        lineas.append(
            f"| {identificador} | {fila['herramienta']} | {fila['casos']} | {fila['estado']} | "
            f"{nombre} |"
        )
    if not pa:
        lineas.append("| — | — | — | — | Sin pruebas de aceptación en los reportes |")
    lineas += [
        "",
        "## Pruebas unitarias y de propiedades por módulo",
        "",
        "| Módulo | IDs | Aprobados | Fallidos |",
        "|---|---|---|---|",
    ]
    por_modulo: dict[str, list[str]] = defaultdict(list)
    for identificador, fila in pu.items():
        por_modulo[identificador.split("-")[1]].append(fila["estado"])
    for modulo, estados in sorted(por_modulo.items()):
        lineas.append(
            f"| {modulo} | {len(estados)} | {estados.count('aprobada')} | "
            f"{estados.count('fallida')} |"
        )
    return "\n".join(lineas) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(prog="docs:tests")
    parser.add_argument("iteracion")
    parser.add_argument("--reportes", type=Path, default=RAIZ / "reports")
    parser.add_argument("--salida", type=Path)
    parser.add_argument(
        "--historias", help="HU separadas por comas, p. ej. HU-01,HU-14"
    )
    argumentos = parser.parse_args()
    if not re.fullmatch(r"it-\d+", argumentos.iteracion):
        sys.exit("Uso: pnpm docs:tests it-N  (por ejemplo: pnpm docs:tests it-1)")
    historias = (
        {
            h.strip().removeprefix("HU-").zfill(2)
            for h in argumentos.historias.split(",")
        }
        if argumentos.historias
        else None
    )
    historias = {f"HU{h}" for h in historias} if historias else None
    salida = argumentos.salida or (
        RAIZ / "docs" / "iteraciones" / argumentos.iteracion / "n6-pruebas.generado.md"
    )
    resultados = leer(argumentos.reportes)
    if not resultados:
        sys.exit(
            f"No hay reportes JUnit con pruebas identificadas en {argumentos.reportes}."
        )
    salida.parent.mkdir(parents=True, exist_ok=True)
    texto = generar(argumentos.iteracion, resultados, historias, datetime.now(UTC))
    salida.write_text(texto, encoding="utf-8", newline="\n")
    print(f"docs:tests {argumentos.iteracion}: {len(resultados)} casos → {salida}")


if __name__ == "__main__":
    main()

"""HU-33: dataset versionado del clasificador, una fila por ejecución, con origen, sujeto y hash.

Entrada: `ejecuciones.jsonl` y `resumen.json` de `pnpm dataset:exportar` (y, si las hay, las
ejecuciones sintéticas del aumento). Salida: `dataset.csv` y `dataset.json` (hash y conteos).
"""

import csv
import hashlib
import io
import json
from collections import Counter
from pathlib import Path

from clasificador.rasgos import RASGOS, rasgos_de

CLASES = ("ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F")
ORIGENES = ("real", "actuado", "sintetico")
# Ningún campo identifica a una persona: el sujeto es el seudónimo de la planilla.
COLUMNAS_FIJAS = ("codigo_toma", "sujeto", "origen", "fila_origen")


def _binario(valor: bool | None) -> str:
    return "" if valor is None else str(int(valor))


def fila(e: dict) -> dict[str, str]:
    if e["origen"] not in ORIGENES:
        raise ValueError(f"{e['codigo_toma']}: origen desconocido {e['origen']!r}")
    if e["origen"] == "sintetico" and not e.get("fila_origen"):
        raise ValueError(f"{e['codigo_toma']}: una fila sintética debe decir de qué fila sale")
    salida = {c: e.get(c) or "" for c in COLUMNAS_FIJAS}
    salida.update({n: f"{v:.6f}" for n, v in rasgos_de(e).items()})
    reglas = e.get("reglas")
    for clase in CLASES:
        salida[f"etiqueta_{clase}"] = _binario(e["etiquetas"].get(clase))
        salida[f"reglas_{clase}"] = "" if reglas is None else str(int(clase in reglas["clases"]))
        juicios = e.get("juicios_dobles", {}).get(clase)
        salida[f"doble_{clase}"] = "".join(str(int(j)) for j in juicios) if juicios else ""
    return salida


def columnas() -> list[str]:
    por_clase = [f"{p}_{c}" for c in CLASES for p in ("etiqueta", "reglas", "doble")]
    return [*COLUMNAS_FIJAS, *RASGOS, *por_clase]


def a_csv(filas: list[dict[str, str]]) -> str:
    salida = io.StringIO()
    escritor = csv.DictWriter(salida, fieldnames=columnas(), lineterminator="\n")
    escritor.writeheader()
    for f in sorted(filas, key=lambda x: x["codigo_toma"]):
        escritor.writerow(f)
    return salida.getvalue()


def construir(ejecuciones: list[dict], resumen: dict) -> tuple[str, dict]:
    """Devuelve el CSV y su manifiesto; el hash es el sha256 del CSV (filas ordenadas)."""
    codigos = Counter(e["codigo_toma"] for e in ejecuciones)
    repetidos = [c for c, n in codigos.items() if n > 1]
    if repetidos:
        raise ValueError(f"Ejecuciones repetidas: {', '.join(sorted(repetidos))}")
    texto = a_csv([fila(e) for e in ejecuciones])
    por_origen = Counter(e["origen"] for e in ejecuciones)
    sujetos = {o: len({e["sujeto"] for e in ejecuciones if e["origen"] == o}) for o in ORIGENES}
    manifiesto = {
        "sha256": hashlib.sha256(texto.encode("utf-8")).hexdigest(),
        "filas": len(ejecuciones),
        "filas_por_origen": {o: por_origen.get(o, 0) for o in ORIGENES},
        "sujetos_por_origen": sujetos,
        "columnas": columnas(),
        "exportacion": resumen,
    }
    return texto, manifiesto


def leer_jsonl(ruta: Path) -> list[dict]:
    return [json.loads(linea) for linea in ruta.read_text("utf-8").splitlines() if linea.strip()]


def escribir(carpeta: Path, texto: str, manifiesto: dict) -> None:
    carpeta.mkdir(parents=True, exist_ok=True)
    for nombre in ("dataset.csv", "dataset.json"):
        if (carpeta / nombre).exists():
            raise FileExistsError(f"{carpeta / nombre} ya existe: usa otra carpeta")
    (carpeta / "dataset.csv").write_text(texto, "utf-8", newline="\n")
    (carpeta / "dataset.json").write_text(
        json.dumps(manifiesto, ensure_ascii=False, indent=2) + "\n",
        "utf-8",
        newline="\n",
    )


def leer(carpeta: Path) -> tuple[list[dict[str, str]], dict]:
    """Lee el dataset y comprueba que el CSV sigue teniendo el hash de su manifiesto."""
    texto = (carpeta / "dataset.csv").read_text("utf-8")
    manifiesto = json.loads((carpeta / "dataset.json").read_text("utf-8"))
    if hashlib.sha256(texto.encode("utf-8")).hexdigest() != manifiesto["sha256"]:
        raise ValueError("El dataset no coincide con el hash de su manifiesto")
    return list(csv.DictReader(io.StringIO(texto))), manifiesto

"""CLI del clasificador (se corre desde research/python, con rutas absolutas):

  uv run python -m clasificador aumentar \
      --ejecuciones <ejecuciones.jsonl> --por-cada-real 3 --semilla 20261112 --salida <carpeta>
  uv run python -m clasificador dataset \
      --ejecuciones <ejecuciones.jsonl> --resumen <resumen.json> [--sinteticas <sinteticas.jsonl>] \
      --salida <carpeta>
  uv run python -m clasificador evaluar --dataset <carpeta> --salida <carpeta>
"""

import argparse
import json
import sys
from pathlib import Path

from clasificador import aumento, dataset, informe, pipeline


def _aumentar(a: argparse.Namespace) -> None:
    sinteticas, registro = aumento.aumentar(
        dataset.leer_jsonl(a.ejecuciones), a.por_cada_real, a.semilla
    )
    a.salida.mkdir(parents=True, exist_ok=True)
    destino = a.salida / "sinteticas.jsonl"
    if destino.exists():
        raise FileExistsError(f"{destino} ya existe: usa otra carpeta")
    destino.write_text(
        "".join(json.dumps(e, ensure_ascii=False) + "\n" for e in sinteticas), "utf-8", newline="\n"
    )
    (a.salida / "sinteticas.registro.json").write_text(
        json.dumps({**registro, "entrada": str(a.ejecuciones)}, ensure_ascii=False, indent=2)
        + "\n",
        "utf-8",
        newline="\n",
    )
    print(f"Sintéticas: {registro['sinteticas']} (semilla {a.semilla}) → {destino}")


def _dataset(a: argparse.Namespace) -> None:
    ejecuciones = dataset.leer_jsonl(a.ejecuciones)
    if a.sinteticas:
        ejecuciones += dataset.leer_jsonl(a.sinteticas)
    resumen = json.loads(a.resumen.read_text("utf-8"))
    texto, manifiesto = dataset.construir(ejecuciones, resumen)
    dataset.escribir(a.salida, texto, manifiesto)
    print(f"Dataset {manifiesto['sha256']}: {manifiesto['filas_por_origen']} → {a.salida}")


def _evaluar(a: argparse.Namespace) -> None:
    protocolo = pipeline.verificar_protocolo(pipeline.RAIZ)
    filas, manifiesto = dataset.leer(a.dataset)
    condiciones = pipeline.suficiencia(filas, manifiesto)
    clases, excluidas = pipeline.clases_incluidas(filas)
    if not clases:
        print("Ninguna clase llega a 8 sujetos reales (DP-06): no hay nada que entrenar.")
    res = pipeline.evaluar(filas, clases)
    datos = {
        "dataset_sha256": manifiesto["sha256"],
        "filas": manifiesto["filas"],
        "filas_por_origen": manifiesto["filas_por_origen"],
        "protocolo_sha256": protocolo,
        "semilla": pipeline.SEMILLA,
    }
    a.salida.mkdir(parents=True, exist_ok=True)
    destino = a.salida / "v3c.md"
    if destino.exists():
        raise FileExistsError(f"{destino} ya existe: usa otra carpeta")
    destino.write_text(informe.informe(res, condiciones, clases, excluidas, datos), "utf-8")
    print(f"Informe: {destino}")
    escenario, nombre, f1, reglas = informe.mejor_modelo(informe.agrupar(res), clases)
    if f1 is not None and reglas is not None and f1 > reglas:
        from clasificador.onnx_export import exportar

        columnas, modelos = pipeline.entrenar_final(filas, clases, escenario, nombre)
        archivos = exportar(columnas, modelos, a.salida / "onnx")
        print(f"ONNX ({nombre}, {escenario}): {', '.join(str(p) for p in archivos.values())}")
    else:
        print("El clasificador no supera a las reglas: no se exporta.")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows no es UTF-8
    p = argparse.ArgumentParser(prog="clasificador")
    sub = p.add_subparsers(dest="orden", required=True)
    au = sub.add_parser("aumentar")
    au.add_argument("--ejecuciones", type=Path, required=True)
    au.add_argument("--por-cada-real", type=int, required=True)
    au.add_argument("--semilla", type=int, default=pipeline.SEMILLA)
    au.add_argument("--salida", type=Path, required=True)
    ds = sub.add_parser("dataset")
    ds.add_argument("--ejecuciones", type=Path, required=True)
    ds.add_argument("--resumen", type=Path, required=True)
    ds.add_argument("--sinteticas", type=Path)
    ds.add_argument("--salida", type=Path, required=True)
    ev = sub.add_parser("evaluar")
    ev.add_argument("--dataset", type=Path, required=True)
    ev.add_argument("--salida", type=Path, required=True)
    a = p.parse_args()
    {"aumentar": _aumentar, "dataset": _dataset, "evaluar": _evaluar}[a.orden](a)


if __name__ == "__main__":
    main()

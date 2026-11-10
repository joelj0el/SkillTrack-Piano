# /// script
# requires-python = "==3.12.*"
# dependencies = []
# ///
"""docs:ids — verifica el ID de cada prueba del repositorio.

Reglas:
- Toda prueba empieza con un ID válido: PA-HUnn-kk, PU-<módulo>-kk o PP-<módulo>-kk
  (en pytest, test_pa_hunn_kk, test_pu_<módulo>_kk o test_pp_<módulo>_kk).
- Solo los PA deben existir en una tarjeta: en docs/01-requerimientos/historias/ o en la
  tabla de criterios de docs/iteraciones/it-N/n2-requerimientos.md.
- Los PU y PP solo necesitan un formato válido y no repetirse.
- El título de una prueba es un texto fijo: un título armado con ${…} no se puede verificar.

Uso: pnpm docs:ids [--raiz DIR]
"""

import argparse
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

RAIZ = Path(__file__).resolve().parents[2]
CARPETAS_TS = ["apps", "packages", "research", "tools", "infra", "e2e"]
CARPETAS_PY = ["apps/api/tests", "research/python/tests"]
OMITIR = {"node_modules", "dist", "fixtures", ".venv", "build", "coverage"}

LLAMADA = re.compile(
    r"(?<![\w.])(?:it|test)(?:\.(?:skip|only|fails|todo|concurrent))?\(\s*"
    r"(?P<q>[\"'`])(?P<titulo>(?:\\.|(?!(?P=q)).)*)(?P=q)",
    re.DOTALL,
)
ID_TITULO = re.compile(r"^(PA-HU\d{2}-\d{2}|P[UP]-[a-z]+-\d{2}):")
FUNCION_PY = re.compile(r"^\s*(?:async\s+)?def\s+(test_\w+)", re.MULTILINE)
ID_PY = re.compile(r"^test_(?:pa_hu(\d{2})_(\d{2})|(pu|pp)_([a-z]+)_(\d{2}))(?:_|$)")
PA_EN_TABLA = re.compile(r"^\|\s*(PA-HU\d{2}-\d{2})\s*\|", re.MULTILINE)
PA_EN_TARJETA = re.compile(r"\bPA-HU\d{2}-\d{2}\b")


@dataclass(frozen=True)
class Prueba:
    ubicacion: str
    id: str | None
    titulo: str


def archivos(raiz: Path, carpetas: list[str], patrones: list[str]) -> list[Path]:
    encontrados: set[Path] = set()
    for carpeta in carpetas:
        base = raiz / carpeta
        if not base.is_dir():
            continue
        for patron in patrones:
            for ruta in base.rglob(patron):
                if not OMITIR.intersection(ruta.relative_to(raiz).parts):
                    encontrados.add(ruta)
    return sorted(encontrados)


def linea(texto: str, posicion: int) -> int:
    return texto.count("\n", 0, posicion) + 1


def pruebas_ts(raiz: Path) -> list[Prueba]:
    pruebas = []
    patrones = ["*.test.ts", "*.test.tsx", "*.spec.ts"]
    for ruta in archivos(raiz, CARPETAS_TS, patrones):
        texto = ruta.read_text(encoding="utf-8")
        for m in LLAMADA.finditer(texto):
            titulo = m.group("titulo")
            ubicacion = f"{ruta.relative_to(raiz).as_posix()}:{linea(texto, m.start())}"
            if m.group("q") == "`" and "${" in titulo:
                pruebas.append(Prueba(ubicacion, None, titulo))
                continue
            encontrado = ID_TITULO.match(titulo)
            pruebas.append(Prueba(ubicacion, encontrado and encontrado.group(1), titulo))
    return pruebas


def pruebas_py(raiz: Path) -> list[Prueba]:
    pruebas = []
    for ruta in archivos(raiz, CARPETAS_PY, ["test_*.py", "*_test.py"]):
        texto = ruta.read_text(encoding="utf-8")
        for m in FUNCION_PY.finditer(texto):
            nombre = m.group(1)
            ubicacion = f"{ruta.relative_to(raiz).as_posix()}:{linea(texto, m.start(1))}"
            p = ID_PY.match(nombre)
            if not p:
                pruebas.append(Prueba(ubicacion, None, nombre))
            elif p.group(1):
                pruebas.append(Prueba(ubicacion, f"PA-HU{p.group(1)}-{p.group(2)}", nombre))
            else:
                tipo = p.group(3).upper()
                pruebas.append(Prueba(ubicacion, f"{tipo}-{p.group(4)}-{p.group(5)}", nombre))
    return pruebas


def criterios_registrados(raiz: Path) -> set[str]:
    registrados: set[str] = set()
    for tarjeta in (raiz / "docs/01-requerimientos/historias").glob("HU-*.md"):
        registrados |= set(PA_EN_TARJETA.findall(tarjeta.read_text(encoding="utf-8")))
    for n2 in (raiz / "docs/iteraciones").glob("it-*/n2-requerimientos.md"):
        registrados |= set(PA_EN_TABLA.findall(n2.read_text(encoding="utf-8")))
    return registrados


def verificar(raiz: Path) -> tuple[int, list[str]]:
    pruebas = pruebas_ts(raiz) + pruebas_py(raiz)
    registrados = criterios_registrados(raiz)
    errores = []
    usos: dict[str, list[str]] = defaultdict(list)
    for p in pruebas:
        if p.id is None:
            motivo = "título armado con ${…}" if "${" in p.titulo else "sin ID válido"
            errores.append(f"{p.ubicacion}: {motivo}: {p.titulo[:80]}")
        elif p.id.startswith("PA-"):
            if p.id not in registrados:
                errores.append(f"{p.ubicacion}: {p.id} no existe en ninguna tarjeta")
        else:
            usos[p.id].append(p.ubicacion)
    for id_, ubicaciones in sorted(usos.items()):
        if len(ubicaciones) > 1:
            errores.append(f"{id_} repetido en: {', '.join(ubicaciones)}")
    return len(pruebas), errores


def main() -> int:
    parser = argparse.ArgumentParser(prog="docs:ids")
    parser.add_argument("--raiz", type=Path, default=RAIZ)
    args = parser.parse_args()
    total, errores = verificar(args.raiz.resolve())
    for error in errores:
        print(error, file=sys.stderr)
    if errores:
        print(f"docs:ids: {len(errores)} errores en {total} pruebas.", file=sys.stderr)
        return 1
    print(f"docs:ids: {total} pruebas con ID válido.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

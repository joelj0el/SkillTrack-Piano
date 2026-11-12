import shutil
from pathlib import Path

import pytest

from clasificador.aumento import aumentar
from clasificador.dataset import construir, escribir, leer
from clasificador.pipeline import (
    SEMILLA,
    clases_incluidas,
    evaluar,
    suficiencia,
    verificar_protocolo,
)
from tests.sinteticos import poblacion, resumen

RAIZ = Path(__file__).resolve().parents[3]


def _dataset(tmp_path, sujetos=10, actuados=2, sinteticas=1):
    reales = poblacion(sujetos=sujetos, por_sujeto=3, semilla=11)
    actuadas = poblacion(sujetos=actuados, por_sujeto=2, semilla=12, origen="actuado")
    for e in actuadas:
        e["sujeto"] = "A" + e["sujeto"]
    sint, _ = aumentar(reales, por_cada_real=sinteticas, semilla=SEMILLA)
    texto, manifiesto = construir(
        [*reales, *actuadas, *sint], resumen(len(reales) + 2, len(reales))
    )
    escribir(tmp_path, texto, manifiesto)
    return leer(tmp_path)


def test_pu_clasificador_04_ningun_sujeto_queda_en_entrenamiento_y_prueba_a_la_vez(tmp_path):
    filas, _ = _dataset(tmp_path)
    res = evaluar(filas, ["ER-A", "ER-C"], modos=("VA",))
    assert res.pliegues > 0
    assert res.sujetos_compartidos == 0
    # Las sintéticas llevan el sujeto de su fila real: ni siquiera ellas cruzan de lado.
    assert any(p.origen == "sintetico" for p in res.predicciones)


def test_pu_clasificador_05_con_la_misma_semilla_el_resultado_es_el_mismo(tmp_path):
    filas, _ = _dataset(tmp_path)
    a = evaluar(filas, ["ER-A", "ER-C"])
    b = evaluar(filas, ["ER-A", "ER-C"])
    assert a.predicciones == b.predicciones


def test_pu_clasificador_07_g2_se_mide_con_las_filas_reales_y_avisa_si_no_se_cumple(tmp_path):
    filas, manifiesto = _dataset(tmp_path, sujetos=6)
    condiciones = {c.nombre: c for c in suficiencia(filas, manifiesto)}
    assert condiciones["Estudiantes"].valor == 6 and not condiciones["Estudiantes"].cumple
    assert condiciones["Tomas válidas"].valor == 18 / 20
    assert condiciones["Tomas válidas"].cumple
    # Sin ronda doble no hay κ: la condición no se da por cumplida.
    assert condiciones["κ entre etiquetadores ER-A"].valor is None
    assert not condiciones["κ entre etiquetadores ER-A"].cumple


def test_pu_clasificador_08_dp06_excluye_las_clases_con_menos_de_8_sujetos_reales(tmp_path):
    filas, _ = _dataset(tmp_path, sujetos=10)
    incluidas, excluidas = clases_incluidas(filas)
    assert "ER-E" in excluidas and excluidas["ER-E"] == 0
    assert set(incluidas) | set(excluidas) == {"ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F"}
    for clase in incluidas:
        sujetos = {
            f["sujeto"] for f in filas if f["origen"] == "real" and f[f"etiqueta_{clase}"] == "1"
        }
        assert len(sujetos) >= 8


def test_pu_clasificador_09_no_se_entrena_si_el_protocolo_cambio(tmp_path):
    assert len(verificar_protocolo(RAIZ)) == 64
    copia = tmp_path / "docs/iteraciones/it-5"
    copia.mkdir(parents=True)
    for nombre in ("protocolo.md", "protocolo.congelado.json"):
        shutil.copy(RAIZ / "docs/iteraciones/it-5" / nombre, copia / nombre)
    verificar_protocolo(tmp_path)
    with (copia / "protocolo.md").open("a", encoding="utf-8") as f:
        f.write("\nCambio después de congelar.\n")
    with pytest.raises(RuntimeError, match="cambió"):
        verificar_protocolo(tmp_path)

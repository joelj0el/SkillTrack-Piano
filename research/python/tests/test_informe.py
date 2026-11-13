import pytest

from clasificador.informe import Metricas, agrupar, f1_macro, informe
from clasificador.pipeline import SEMILLA, clases_incluidas, evaluar, suficiencia
from tests.test_pipeline import _dataset


def test_pu_clasificador_06_metricas_por_origen_y_reglas_fuera_de_las_sinteticas(
    tmp_path,
):
    filas, _ = _dataset(tmp_path)
    tabla = agrupar(evaluar(filas, ["ER-A"], modos=("VA",)))
    origenes = {k[3] for k in tabla if k[0] == "con_sinteticos" and k[2] == "logistica"}
    assert origenes == {"real", "actuado", "sintetico"}
    assert not any(k[2] == "reglas" and k[3] == "sintetico" for k in tabla)
    assert not any(k[0] == "solo_reales" and k[3] != "real" for k in tabla)
    assert f1_macro(tabla, "solo_reales", "VA", "reglas", "real", ["ER-A"]) == 1.0


def test_pu_clasificador_10_metricas_de_la_matriz_de_confusion():
    m = Metricas(n=10, tp=3, fp=1, fn=2, tn=4)
    assert m.exhaustividad == pytest.approx(0.6)
    assert m.f1 == pytest.approx(2 / 3)
    assert m.kappa == pytest.approx((0.7 - 0.5) / 0.5)
    assert Metricas(n=4, tp=0, fp=0, fn=0, tn=4).kappa is None


def test_pu_clasificador_11_el_informe_trae_g2_dp06_no_fuga_matrices_ablacion_y_exportacion(
    tmp_path,
):
    filas, manifiesto = _dataset(tmp_path, sujetos=6)
    incluidas, excluidas = clases_incluidas(filas)
    clases = incluidas or ["ER-A"]
    texto = informe(
        evaluar(filas, clases),
        suficiencia(filas, manifiesto),
        clases,
        excluidas,
        {
            "dataset_sha256": manifiesto["sha256"],
            "filas": manifiesto["filas"],
            "filas_por_origen": manifiesto["filas_por_origen"],
            "protocolo_sha256": "0" * 64,
            "semilla": SEMILLA,
        },
    )
    assert "**Aviso: no se cumple G-2**" in texto
    assert "excluida: " in texto
    assert "sujetos compartidos entre entrenamiento y prueba: 0" in texto
    assert "## Matrices de confusión" in texto and "| reglas |" in texto
    assert "## Ablación V / A / VA" in texto
    assert "| solo_reales | logistica | real |" in texto
    assert "| con_sinteticos | logistica | sintetico |" in texto
    assert "## Exportación" in texto

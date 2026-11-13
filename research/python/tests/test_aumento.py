import pytest

from clasificador.aumento import aumentar
from clasificador.dataset import construir
from tests.sinteticos import ejecucion, poblacion, resumen


def test_pu_aumento_01_cada_sintetica_marca_su_origen_su_fila_real_y_su_sujeto():
    reales = poblacion(sujetos=3, por_sujeto=2, semilla=1)
    actuada = ejecucion("S09-ACT", "S09", "actuado")
    sinteticas, registro = aumentar([*reales, actuada], por_cada_real=2, semilla=7)
    assert len(sinteticas) == 12 and registro["reales"] == 6 and registro["sinteticas"] == 12
    base = {e["codigo_toma"]: e for e in reales}
    for s in sinteticas:
        assert s["origen"] == "sintetico"
        assert s["fila_origen"] in base  # nunca parte de una actuada
        assert s["sujeto"] == base[s["fila_origen"]]["sujeto"]
        assert s["reglas"] is None and s["juicios_dobles"] == {}
    # Las sintéticas entran al dataset como tales.
    _, manifiesto = construir([*reales, *sinteticas], resumen(6, 6))
    assert manifiesto["filas_por_origen"]["sintetico"] == 12


def test_pu_aumento_02_la_misma_semilla_da_las_mismas_ejecuciones_y_otra_semilla_no():
    reales = poblacion(sujetos=3, por_sujeto=2, semilla=1)
    a, ra = aumentar(reales, por_cada_real=2, semilla=7)
    b, _ = aumentar(reales, por_cada_real=2, semilla=7)
    c, _ = aumentar(reales, por_cada_real=2, semilla=8)
    assert a == b and a != c
    assert ra["semilla"] == 7


def test_pu_aumento_03_las_perturbaciones_quedan_en_el_rango_observado_y_los_errores_se_etiquetan():
    reales = poblacion(sujetos=4, por_sujeto=3, semilla=2)
    sinteticas, registro = aumentar(reales, por_cada_real=5, semilla=3)
    observados: dict[str, list[float]] = {}
    for e in reales:
        for d in e["desviaciones"]:
            observados.setdefault(d["rasgo"], []).append(d["valor"])
    for s in sinteticas:
        for d in s["desviaciones"]:
            if d["rasgo"] == "cambio_tempo.pct" and d["posicion"] == "encima":
                continue  # error de tempo inyectado: fuera de la banda a propósito
            assert min(observados[d["rasgo"]]) <= d["valor"] <= max(observados[d["rasgo"]])
    assert sum(registro["errores_inyectados"].values()) > 0
    for s in sinteticas:
        if any(x["nota"] == "incorrecta" for x in s["eventos"]):
            assert s["etiquetas"]["ER-A"] is True


def test_pu_aumento_04_sin_reales_no_hay_de_donde_partir():
    with pytest.raises(ValueError, match="reales"):
        aumentar([ejecucion("A", "S01", "actuado")], por_cada_real=1, semilla=1)

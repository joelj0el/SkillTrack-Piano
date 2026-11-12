from clasificador.rasgos import RASGOS, columnas_de_modo, rasgos_de
from tests.sinteticos import ejecucion


def test_pu_clasificador_01_los_rasgos_resumen_cada_familia_de_error():
    r = rasgos_de(ejecucion("T1", "S01", nota_mal=2, dedo_mal=5, zona_baja=1, cambio_tempo=25.0))
    assert r["a_nota_error"] == 0.2
    assert r["v_dedo_error"] == 0.5
    assert r["v_zona_debajo"] == 0.1
    assert r["v_zona_encima"] == 0.0
    assert r["a_cambio_tempo"] == 25.0
    assert r["a_sin_tempo"] == 0.0
    limpio = rasgos_de(ejecucion("T2", "S01", cambio_tempo=None))
    assert limpio["a_nota_error"] == limpio["v_dedo_error"] == 0.0
    assert (limpio["a_cambio_tempo"], limpio["a_sin_tempo"]) == (0.0, 1.0)


def test_pu_clasificador_02_entre_modalidades_la_tecla_vista_y_la_nota_oida_no_coinciden():
    e = ejecucion("T1", "S01", nota_mal=3)
    assert rasgos_de(e)["va_tecla_vs_nota"] == 0.3
    e["eventos"][0]["modalidad"] = "V"
    e["eventos"][1]["estado"] = "no-evaluable"
    r = rasgos_de(e)
    assert r["va_una_sola_modalidad"] == 1 / 9
    assert r["va_no_evaluables"] == 0.1


def test_pu_clasificador_03_la_ablacion_separa_vision_audio_y_ambos():
    v, a, va = (set(columnas_de_modo(m)) for m in ("V", "A", "VA"))
    assert v and a and not v & a
    assert va == set(RASGOS)
    assert {"va_tecla_vs_nota", "va_una_sola_modalidad"} <= va - v - a
    assert all(n.startswith("v_") for n in v) and all(n.startswith("a_") for n in a)

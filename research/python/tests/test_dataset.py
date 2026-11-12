import pytest

from clasificador.dataset import CLASES, construir, escribir, leer
from tests.sinteticos import ejecucion, resumen


def test_pu_dataset_01_cada_fila_lleva_origen_sujeto_rasgos_etiquetas_y_reglas():
    e = ejecucion(
        "S01-R1",
        "S01",
        nota_mal=2,
        etiquetas={"ER-A": True, "ER-B": None},
        reglas=["ER-A", "ER-C"],
        dobles={"ER-A": [True, False]},
    )
    texto, manifiesto = construir([e], resumen(2, 1))
    cabecera, fila = texto.splitlines()
    datos = dict(zip(cabecera.split(","), fila.split(","), strict=True))
    assert (datos["codigo_toma"], datos["sujeto"], datos["origen"]) == ("S01-R1", "S01", "real")
    assert datos["a_nota_error"] == "0.200000"
    assert (datos["etiqueta_ER-A"], datos["etiqueta_ER-B"], datos["etiqueta_ER-C"]) == ("1", "", "")
    assert (datos["reglas_ER-A"], datos["reglas_ER-B"], datos["reglas_ER-C"]) == ("1", "0", "1")
    assert datos["doble_ER-A"] == "10"
    assert manifiesto["filas_por_origen"] == {"real": 1, "actuado": 0, "sintetico": 0}
    assert manifiesto["exportacion"]["tomas"]["real"] == {
        "total": 2,
        "validas": 1,
        "sin_reprocesar": 0,
    }
    assert len(manifiesto["sha256"]) == 64
    assert all(f"etiqueta_{c}" in manifiesto["columnas"] for c in CLASES)


def test_pu_dataset_02_el_hash_no_depende_del_orden_y_cambia_con_los_datos():
    a, b = ejecucion("S01-R1", "S01"), ejecucion("S02-R1", "S02", nota_mal=1)
    h1 = construir([a, b], resumen(2, 2))[1]["sha256"]
    h2 = construir([b, a], resumen(2, 2))[1]["sha256"]
    h3 = construir([a, ejecucion("S02-R1", "S02", nota_mal=2)], resumen(2, 2))[1]["sha256"]
    assert h1 == h2 != h3


def test_pu_dataset_03_ningun_campo_identifica_a_una_persona(tmp_path):
    e = ejecucion("S01-R1", "S01")
    e["nombre"] = "Ana Pérez"
    e["ruta"] = "C:/datos/S01"
    texto, manifiesto = construir([e], resumen(1, 1))
    assert "Ana" not in texto and "datos" not in texto
    assert set(manifiesto["columnas"][:4]) == {"codigo_toma", "sujeto", "origen", "fila_origen"}


def test_pu_dataset_04_rechaza_origenes_desconocidos_sinteticas_sin_origen_y_repetidas():
    with pytest.raises(ValueError, match="origen desconocido"):
        construir([ejecucion("X", "S01", "inventado")], resumen(1, 1))
    with pytest.raises(ValueError, match="de qué fila sale"):
        construir([ejecucion("X", "S01", "sintetico")], resumen(1, 1))
    with pytest.raises(ValueError, match="repetidas"):
        construir([ejecucion("X", "S01"), ejecucion("X", "S01")], resumen(1, 1))


def test_pu_dataset_05_al_leer_se_comprueba_el_hash_y_no_se_sobrescribe(tmp_path):
    texto, manifiesto = construir([ejecucion("S01-R1", "S01")], resumen(1, 1))
    escribir(tmp_path, texto, manifiesto)
    filas, leido = leer(tmp_path)
    assert filas[0]["sujeto"] == "S01" and leido["sha256"] == manifiesto["sha256"]
    with pytest.raises(FileExistsError):
        escribir(tmp_path, texto, manifiesto)
    (tmp_path / "dataset.csv").write_text(texto.replace("S01", "S99"), "utf-8", newline="\n")
    with pytest.raises(ValueError, match="hash"):
        leer(tmp_path)

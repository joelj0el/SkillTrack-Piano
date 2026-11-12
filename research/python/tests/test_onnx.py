import numpy as np
import pytest

from clasificador.aumento import aumentar
from clasificador.dataset import construir, escribir, leer
from clasificador.onnx_export import exportar, predecir_onnx
from clasificador.pipeline import SEMILLA, entrenar_final
from tests.sinteticos import poblacion, resumen


@pytest.mark.parametrize("nombre", ["logistica", "arbol"])
def test_pu_clasificador_12_onnx_predice_lo_mismo_que_scikit_learn(tmp_path, nombre):
    reales = poblacion(sujetos=8, por_sujeto=3, semilla=21)
    sint, _ = aumentar(reales, por_cada_real=2, semilla=SEMILLA)
    texto, manifiesto = construir([*reales, *sint], resumen(24, 24))
    escribir(tmp_path / "d", texto, manifiesto)
    filas, _ = leer(tmp_path / "d")
    columnas, modelos = entrenar_final(filas, ["ER-A", "ER-C"], "con_sinteticos", nombre)
    archivos = exportar(columnas, modelos, tmp_path / "onnx")
    x = np.array([[float(f[c]) for c in columnas] for f in filas], dtype=np.float32)
    for clase, ruta in archivos.items():
        np.testing.assert_array_equal(predecir_onnx(ruta, x), modelos[clase].predict(x))
    with pytest.raises(FileExistsError):
        exportar(columnas, modelos, tmp_path / "onnx")

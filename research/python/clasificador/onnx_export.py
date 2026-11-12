"""Exportación a ONNX: un modelo por clase, solo si el clasificador supera a las reglas."""

from pathlib import Path

import numpy as np
import onnxruntime as ort
from skl2onnx import to_onnx


def exportar(columnas: list[str], modelos: dict, carpeta: Path) -> dict[str, Path]:
    carpeta.mkdir(parents=True, exist_ok=True)
    archivos = {}
    muestra = np.zeros((1, len(columnas)), dtype=np.float32)
    for clase, m in modelos.items():
        onx = to_onnx(m, muestra, options={id(m): {"zipmap": False}}, target_opset=17)
        ruta = carpeta / f"clasificador-{clase}.onnx"
        if ruta.exists():
            raise FileExistsError(f"{ruta} ya existe: usa otra carpeta")
        ruta.write_bytes(onx.SerializeToString())
        archivos[clase] = ruta
    return archivos


def predecir_onnx(ruta: Path, x: np.ndarray) -> np.ndarray:
    sesion = ort.InferenceSession(str(ruta), providers=["CPUExecutionProvider"])
    entrada = sesion.get_inputs()[0].name
    etiquetas = sesion.run(None, {entrada: x.astype(np.float32)})[0]
    return np.asarray(etiquetas).astype(int)

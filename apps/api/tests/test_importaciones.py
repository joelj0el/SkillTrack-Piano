import os
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ_API = Path(__file__).resolve().parents[1]
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "importaciones"


def test_pu_api_07_import_linter_detecta_core_que_importa_modules():
    lint_imports = shutil.which("lint-imports", path=str(Path(sys.executable).parent))
    assert lint_imports is not None

    resultado = subprocess.run(
        [lint_imports, "--config", str(RAIZ_API / "pyproject.toml"), "--no-cache"],
        cwd=FIXTURE,
        env={**os.environ, "PYTHONPATH": str(FIXTURE)},
        capture_output=True,
        text=True,
    )

    assert resultado.returncode != 0
    assert "BROKEN" in resultado.stdout

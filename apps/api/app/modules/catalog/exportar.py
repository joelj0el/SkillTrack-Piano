"""Imprime el catálogo vigente en JSON (el mismo contrato que GET /api/catalogo/ejercicios).

Lo usa el reprocesamiento de la estación de investigación para tomar las notas esperadas de la
partitura importada. Uso: python -m app.modules.catalog.exportar > catalogo.json
"""

import json
import sys

from sqlalchemy.orm import Session

from app.core.db import crear_engine
from app.modules.catalog.service import ejercicio_dto, ejercicios_vigentes


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    with Session(crear_engine()) as db:
        ejercicios = [
            ejercicio_dto(e, v).model_dump(mode="json") for e, v in ejercicios_vigentes(db)
        ]
    print(json.dumps(ejercicios, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Intento: los eventos pasan al registro v2, con la modalidad de cada dato

Los datos que la v1 no registraba (estado de la nota, tecla, desfase entre manos) quedan en null
o "sin-dato". La conversión está copiada aquí a propósito: una migración no debe cambiar si
cambia el código de la aplicación.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-11
"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"
ESTADO_DEDO_V1 = {"digitacion-correcta": "correcto", "dedo-incorrecto": "incorrecto"}
ESTADO_DEDO_V2 = {"correcto": "digitacion-correcta", "incorrecto": "dedo-incorrecto"}


def _a_v2(e: dict) -> dict:
    if "nota" in e:
        return e
    dedo = e.get("dedo")
    rasgos = e.get("rasgos") or {}
    return {
        "idx": e["idx"],
        "mano": e.get("mano"),
        "midi_esperado": e.get("midi"),
        "dedo_esperado": None,
        "estado": "no-evaluable" if e["estado"] == "no-evaluable" else "evaluado",
        "motivo": e.get("motivo"),
        "ataque_ms": None,
        "modalidad": None,
        "nota": {"estado": "sin-dato", "midi": None, "clase_oida": None, "modalidad": None},
        "dedo": {
            "valor": dedo,
            "estado": ESTADO_DEDO_V1.get(e["estado"])
            or ("sin-esperado" if dedo is not None else "no-detectado"),
            "modalidad": "V" if dedo is not None else None,
        },
        "tecla": {"midi": None, "zona": None, "modalidad": None},
        "desfase_manos": None,
        "rasgos": rasgos,
        "rasgos_modalidad": "V" if rasgos else None,
    }


def _a_v1(e: dict) -> dict:
    if "nota" not in e:
        return e
    return {
        "idx": e["idx"],
        "estado": ESTADO_DEDO_V2.get(e["dedo"]["estado"], "no-evaluable"),
        "motivo": e.get("motivo"),
        "mano": e.get("mano"),
        "dedo": e["dedo"]["valor"],
        "midi": e.get("midi_esperado"),
        "rasgos": e.get("rasgos") or {},
    }


def _convertir(funcion) -> None:
    conexion = op.get_bind()
    filas = conexion.execute(sa.text(f"SELECT id, eventos FROM {ESQUEMA}.intento")).all()
    for id_, eventos in filas:
        nuevos = [funcion(e) for e in eventos]
        if nuevos != eventos:
            conexion.execute(
                sa.text(f"UPDATE {ESQUEMA}.intento SET eventos = CAST(:e AS jsonb) WHERE id = :id"),
                {"e": json.dumps(nuevos), "id": id_},
            )


def upgrade() -> None:
    _convertir(_a_v2)


def downgrade() -> None:
    _convertir(_a_v1)

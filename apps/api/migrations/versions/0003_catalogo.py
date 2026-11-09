"""Catálogo: ejercicio, version_ejercicio y clase_error, con el repertorio v0 y la taxonomía v0.1

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-28

Los eventos esperados y la partitura quedan vacíos hasta que la partitura del panel se transcriba
a MusicXML y un docente la verifique nota por nota: no se infieren desde imágenes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"

# Repertorio v0: escalas del Hanon nº 39 en el orden del panel; 2/4 en semicorcheas.
REPERTORIO = [
    ("EJ-01", "Escala de Do mayor", "Do mayor", 1),
    ("EJ-02", "Escala de Fa mayor", "Fa mayor", 2),
    ("EJ-03", "Escala de Si♭ mayor", "Si♭ mayor", 3),
    ("EJ-04", "Escala de Mi♭ mayor", "Mi♭ mayor", 4),
]

# Taxonomía v0.1, nivel 1: código, nombre pedagógico, variable para el estudiante, modalidad.
CLASES = [
    ("ER-A", "Notas incorrectas", "Notas", "A"),
    ("ER-B", "Desfase rítmico", "Ritmo", "VA"),
    ("ER-C", "Digitación", "Digitación", "VA"),
    ("ER-D", "Posición del dedo en la tecla", "Lugar del dedo en la tecla", "V"),
    ("ER-E", "Dedos sin curvatura", "Curvatura de los dedos", "V"),
    ("ER-F", "Signos de tensión en mano y muñeca", "Soltura de mano y muñeca", "V"),
]


def upgrade() -> None:
    ejercicio = op.create_table(
        "ejercicio",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("codigo", sa.String(8), nullable=False, unique=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("fuente", sa.String(120), nullable=False),
        sa.Column("variantes_manos", postgresql.ARRAY(sa.String(8)), nullable=False),
        sa.Column("tonalidad", sa.String(40), nullable=False),
        sa.Column("compas", sa.String(8), nullable=False),
        sa.Column("figura", sa.String(40), nullable=False),
        sa.Column("orden", sa.Integer, nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.true()),
        schema=ESQUEMA,
    )
    version = op.create_table(
        "version_ejercicio",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "ejercicio_id", sa.Integer, sa.ForeignKey(f"{ESQUEMA}.ejercicio.id"), nullable=False
        ),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("tempo_min_permitido_bpm", sa.Integer, nullable=False),
        sa.Column("tempo_max_permitido_bpm", sa.Integer, nullable=False),
        sa.Column("rango_octavas", sa.Integer, nullable=False),
        sa.Column("nota_min_midi", sa.Integer),
        sa.Column("nota_max_midi", sa.Integer),
        sa.Column("eventos_esperados", postgresql.JSONB, nullable=False),
        sa.Column("partitura_svg", sa.Text),
        sa.UniqueConstraint("ejercicio_id", "version"),
        schema=ESQUEMA,
    )
    clase = op.create_table(
        "clase_error",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("codigo", sa.String(8), nullable=False),
        sa.Column("nombre_pedagogico", sa.String(120), nullable=False),
        sa.Column("variable_estudiante", sa.String(80), nullable=False),
        sa.Column("definicion", sa.Text),
        sa.Column("modalidad", sa.String(2), nullable=False),
        sa.Column("version_taxonomia", sa.String(16), nullable=False),
        sa.UniqueConstraint("codigo", "version_taxonomia"),
        schema=ESQUEMA,
    )
    op.bulk_insert(
        ejercicio,
        [
            {
                "id": orden,
                "codigo": codigo,
                "nombre": nombre,
                "fuente": "Hanon nº 39",
                "variantes_manos": ["MI", "MD", "juntas"],
                "tonalidad": tonalidad,
                "compas": "2/4",
                "figura": "semicorchea",
                "orden": orden,
                "activo": True,
            }
            for codigo, nombre, tonalidad, orden in REPERTORIO
        ],
    )
    op.bulk_insert(
        version,
        [
            {
                "id": orden,
                "ejercicio_id": orden,
                "version": 1,
                # PRM-02: rango que el docente puede asignar.
                "tempo_min_permitido_bpm": 60,
                "tempo_max_permitido_bpm": 75,
                # PRM-01: dos octavas por mano.
                "rango_octavas": 2,
                "nota_min_midi": None,
                "nota_max_midi": None,
                "eventos_esperados": [],
                "partitura_svg": None,
            }
            for _, _, _, orden in REPERTORIO
        ],
    )
    op.bulk_insert(
        clase,
        [
            {
                "codigo": codigo,
                "nombre_pedagogico": nombre,
                "variable_estudiante": variable,
                "definicion": None,
                "modalidad": modalidad,
                "version_taxonomia": "v0.1",
            }
            for codigo, nombre, variable, modalidad in CLASES
        ],
    )
    for tabla in ("ejercicio", "version_ejercicio"):
        op.execute(
            f"SELECT setval(pg_get_serial_sequence('{ESQUEMA}.{tabla}', 'id'), "
            f"(SELECT max(id) FROM {ESQUEMA}.{tabla}))"
        )


def downgrade() -> None:
    op.drop_table("clase_error", schema=ESQUEMA)
    op.drop_table("version_ejercicio", schema=ESQUEMA)
    op.drop_table("ejercicio", schema=ESQUEMA)

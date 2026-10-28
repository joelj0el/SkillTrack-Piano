"""Identidad: usuario, sesion_auth, institucion, membresia y auditoria_acceso

Revision ID: 0001
Revises:
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ESQUEMA = "app"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {ESQUEMA}")
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("nombre_visible", sa.String(120), nullable=False),
        sa.Column("email", sa.String(254)),
        sa.Column("hash_clave", sa.String(255), nullable=False),
        sa.Column("es_menor", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("superadmin", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("clave_temporal", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        schema=ESQUEMA,
    )
    op.create_table(
        "sesion_auth",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column(
            "usuario_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.usuario.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ultima_actividad", sa.DateTime(timezone=True), nullable=False),
        schema=ESQUEMA,
    )
    op.create_index("ix_sesion_auth_usuario", "sesion_auth", ["usuario_id"], schema=ESQUEMA)
    op.create_table(
        "institucion",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nombre", sa.String(160), nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.true()),
        schema=ESQUEMA,
    )
    rol = sa.Enum("admin_inst", "docente", "estudiante", "investigador", name="rol", schema=ESQUEMA)
    op.create_table(
        "membresia",
        sa.Column(
            "usuario_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.usuario.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "institucion_id",
            sa.Integer,
            sa.ForeignKey(f"{ESQUEMA}.institucion.id"),
            primary_key=True,
        ),
        sa.Column("rol", rol, primary_key=True),
        schema=ESQUEMA,
    )
    op.create_table(
        "auditoria_acceso",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "actor_id", sa.Integer, sa.ForeignKey(f"{ESQUEMA}.usuario.id", ondelete="SET NULL")
        ),
        sa.Column("accion", sa.String(64), nullable=False),
        sa.Column("recurso", sa.String(64), nullable=False),
        sa.Column("recurso_id", sa.Integer),
        sa.Column(
            "fecha", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        schema=ESQUEMA,
    )
    op.create_index(
        "ix_auditoria_recurso_fecha",
        "auditoria_acceso",
        ["recurso", "recurso_id", "fecha"],
        schema=ESQUEMA,
    )


def downgrade() -> None:
    op.drop_table("auditoria_acceso", schema=ESQUEMA)
    op.drop_table("membresia", schema=ESQUEMA)
    sa.Enum(name="rol", schema=ESQUEMA).drop(op.get_bind(), checkfirst=True)
    op.drop_table("institucion", schema=ESQUEMA)
    op.drop_table("sesion_auth", schema=ESQUEMA)
    op.drop_table("usuario", schema=ESQUEMA)
    op.execute(f"DROP SCHEMA IF EXISTS {ESQUEMA}")

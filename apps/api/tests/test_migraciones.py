from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

import app.modules.models  # noqa: F401
from app.core.db import ESQUEMA, Base
from tests.conftest import alembic


def test_pu_api_02_migraciones_suben_y_bajan(url_migrada: str):
    config = alembic(url_migrada)

    command.downgrade(config, "base")
    assert ESQUEMA not in inspect(create_engine(url_migrada)).get_schema_names()

    command.upgrade(config, "head")
    assert "alembic_version" in inspect(create_engine(url_migrada)).get_table_names()


def test_pu_api_08_los_modelos_coinciden_con_las_migraciones(url_migrada: str):
    with create_engine(url_migrada).connect() as conexion:
        contexto = MigrationContext.configure(
            conexion, opts={"include_schemas": True, "compare_type": True}
        )
        diferencias = compare_metadata(contexto, Base.metadata)

    assert diferencias == []

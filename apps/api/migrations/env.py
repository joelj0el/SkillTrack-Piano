from logging.config import fileConfig

from alembic import context

import app.modules.models  # noqa: F401  (registra los modelos en Base.metadata)
from app.core.config import obtener_configuracion
from app.core.db import Base, crear_engine

if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def migrar_sin_conexion() -> None:
    context.configure(
        url=obtener_configuracion().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def migrar_con_conexion() -> None:
    with crear_engine().connect() as conexion:
        context.configure(
            connection=conexion, target_metadata=target_metadata, include_schemas=True
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    migrar_sin_conexion()
else:
    migrar_con_conexion()

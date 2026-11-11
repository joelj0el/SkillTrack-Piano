import json

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

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


def test_pu_api_10_los_eventos_v1_guardados_pasan_a_v2_y_vuelven(url_migrada: str):
    from sqlalchemy import text

    from tests import fabricas

    config = alembic(url_migrada)
    motor = create_engine(url_migrada)
    command.downgrade(config, "0006")
    try:
        with Session(motor) as sesion:
            estudiante = fabricas.usuario(sesion, "migracion.eventos")
            sesion.commit()
            v1 = [
                {
                    "idx": 0,
                    "estado": "digitacion-correcta",
                    "motivo": None,
                    "mano": "MD",
                    "dedo": 1,
                    "midi": 60,
                    "rasgos": {},
                }
            ]
            sesion.execute(
                text(
                    "INSERT INTO app.intento (client_uuid, estudiante_id, version_ejercicio_id,"
                    " version_nucleo, version_modelo_mano, instrumento, manos, clase_dispositivo,"
                    " modo, estado, cuenta_para_tarea, iniciado_en, duracion_ms, eventos)"
                    " VALUES (gen_random_uuid(), :e, 1, '0.1.0', 'm', 'digital', 'MD', 'x', 'V',"
                    " 'evaluado', false, now(), 0, CAST(:ev AS jsonb))"
                ),
                {"e": estudiante.id, "ev": json.dumps(v1)},
            )
            sesion.commit()
        command.upgrade(config, "0007")
        with motor.connect() as c:
            [evento] = c.execute(text("SELECT eventos FROM app.intento")).scalar_one()
        assert evento["dedo"] == {"valor": 1, "estado": "correcto", "modalidad": "V"}
        assert evento["nota"]["estado"] == "sin-dato"
        command.downgrade(config, "0006")
        with motor.connect() as c:
            assert c.execute(text("SELECT eventos FROM app.intento")).scalar_one() == v1
    finally:
        command.upgrade(config, "head")
        with motor.begin() as c:
            c.execute(text("TRUNCATE app.intento, app.usuario RESTART IDENTITY CASCADE"))

from sqlalchemy import create_engine, inspect

from app.core.db import ESQUEMA


def test_pu_identity_01_la_migracion_crea_las_tablas_de_identidad(url_migrada: str):
    tablas = set(inspect(create_engine(url_migrada)).get_table_names(schema=ESQUEMA))

    assert {"usuario", "sesion_auth", "institucion", "membresia", "auditoria_acceso"} <= tablas


def test_pu_identity_02_el_nombre_de_usuario_es_unico(url_migrada: str):
    restricciones = inspect(create_engine(url_migrada)).get_unique_constraints(
        "usuario", schema=ESQUEMA
    )

    assert any(r["column_names"] == ["username"] for r in restricciones)

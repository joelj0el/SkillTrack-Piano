from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def test_pu_api_02_migraciones_suben_y_bajan(url_postgres: str, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", url_postgres)
    config = Config(str(ALEMBIC_INI))

    command.upgrade(config, "head")
    assert "alembic_version" in inspect(create_engine(url_postgres)).get_table_names()

    command.downgrade(config, "base")

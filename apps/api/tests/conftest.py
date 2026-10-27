from collections.abc import Iterator

import pytest
from testcontainers.community.postgres import PostgresContainer


@pytest.fixture(scope="session")
def url_postgres() -> Iterator[str]:
    with PostgresContainer("postgres:17.11", driver="psycopg") as postgres:
        yield postgres.get_connection_url()

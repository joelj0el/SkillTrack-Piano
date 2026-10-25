"""tempo asignado en tareas

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-19

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("assigned_tasks", sa.Column("tempo_bpm", sa.Integer, nullable=True))


def downgrade() -> None:
    op.drop_column("assigned_tasks", "tempo_bpm")

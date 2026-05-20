"""add morning bonus window

Revision ID: af3b2c1d9e44
Revises: 3d9a8f2c7e11
Create Date: 2026-05-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "af3b2c1d9e44"
down_revision: Union[str, None] = "3d9a8f2c7e11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "activity_settings",
        sa.Column("morning_bonus_start_time", sa.String(length=5), nullable=False, server_default="06:30"),
    )
    op.add_column(
        "activity_settings",
        sa.Column("morning_bonus_end_time", sa.String(length=5), nullable=False, server_default="07:40"),
    )


def downgrade() -> None:
    op.drop_column("activity_settings", "morning_bonus_end_time")
    op.drop_column("activity_settings", "morning_bonus_start_time")

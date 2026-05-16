"""add speaking item fields

Revision ID: 3d9a8f2c7e11
Revises: 9517f518c5ad
Create Date: 2026-05-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "3d9a8f2c7e11"
down_revision: Union[str, None] = "9517f518c5ad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("checkin_items", sa.Column("speaking_minutes", sa.Float(), nullable=True))
    op.add_column("checkin_items", sa.Column("speaking_dialogue_sentences", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("checkin_items", "speaking_dialogue_sentences")
    op.drop_column("checkin_items", "speaking_minutes")

"""init tables

Revision ID: 9517f518c5ad
Revises: 
Create Date: 2026-04-20 16:39:50.659253

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9517f518c5ad'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('admins',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('username', sa.String(length=50), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('username')
    )

    op.create_table('activity_settings',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('start_date', sa.Date(), nullable=False),
    sa.Column('duration_days', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('daily_checkins',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('student_id', sa.String(length=50), nullable=False),
    sa.Column('checkin_date', sa.Date(), nullable=False),
    sa.Column('first_submitted_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('first_valid_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('earned_morning_bonus', sa.Boolean(), nullable=False),
    sa.Column('base_points', sa.Integer(), nullable=False),
    sa.Column('total_points', sa.Integer(), nullable=False),
    sa.Column('total_volume', sa.Float(), nullable=False),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('student_id', 'checkin_date', name='uq_daily_checkins_student_date')
    )

    op.create_table('checkin_items',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('checkin_id', sa.String(length=36), nullable=False),
    sa.Column('item_type', sa.String(length=30), nullable=False),
    sa.Column('is_valid', sa.Boolean(), nullable=False),
    sa.Column('points', sa.Integer(), nullable=False),
    sa.Column('volume_score', sa.Float(), nullable=False),
    sa.Column('listening_questions', sa.Integer(), nullable=True),
    sa.Column('reading_articles', sa.Integer(), nullable=True),
    sa.Column('reading_questions', sa.Integer(), nullable=True),
    sa.Column('writing_words', sa.Integer(), nullable=True),
    sa.Column('vocabulary_words', sa.Integer(), nullable=True),
    sa.Column('running_distance_km', sa.Float(), nullable=True),
    sa.Column('running_pace_min_per_km', sa.Float(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.ForeignKeyConstraint(['checkin_id'], ['daily_checkins.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('checkin_id', 'item_type', name='uq_checkin_items_checkin_type')
    )

    op.create_table('checkin_attachments',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('item_id', sa.String(length=36), nullable=False),
    sa.Column('item_type', sa.String(length=30), nullable=False),
    sa.Column('file_name', sa.String(length=255), nullable=False),
    sa.Column('file_url', sa.Text(), nullable=False),
    sa.Column('file_size', sa.Integer(), nullable=False),
    sa.Column('file_type', sa.String(length=100), nullable=False),
    sa.Column('oss_key', sa.String(length=500), nullable=False),
    sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
    sa.ForeignKeyConstraint(['item_id'], ['checkin_items.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('checkin_attachments')
    op.drop_table('checkin_items')
    op.drop_table('daily_checkins')
    op.drop_table('activity_settings')
    op.drop_table('admins')

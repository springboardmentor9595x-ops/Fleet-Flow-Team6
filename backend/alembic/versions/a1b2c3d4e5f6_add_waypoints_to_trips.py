"""add waypoints column to trips

Revision ID: a1b2c3d4e5f6
Revises: 45fce1d17fd7
Create Date: 2026-08-20 21:50:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '8f0a1b2c3d4e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('trips', sa.Column('waypoints', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('trips', 'waypoints')

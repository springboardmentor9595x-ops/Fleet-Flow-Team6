"""add otp columns

Revision ID: 477951ad2918
Revises: e14a5c2164e7
Create Date: 2026-08-04 19:02:17.685953

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '477951ad2918'
down_revision: Union[str, Sequence[str], None] = 'e14a5c2164e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('otp_code', sa.String(length=6), nullable=True))
    op.add_column('users', sa.Column('otp_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'otp_expires_at')
    op.drop_column('users', 'otp_code')

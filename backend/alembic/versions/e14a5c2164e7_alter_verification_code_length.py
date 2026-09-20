"""alter verification code length

Revision ID: e14a5c2164e7
Revises: 5a6414a67186
Create Date: 2026-08-04 18:56:17.038161

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e14a5c2164e7'
down_revision: Union[str, Sequence[str], None] = '5a6414a67186'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('users', 'verification_code',
               existing_type=sa.String(length=6),
               type_=sa.String(length=500),
               existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('users', 'verification_code',
               existing_type=sa.String(length=500),
               type_=sa.String(length=6),
               existing_nullable=True)

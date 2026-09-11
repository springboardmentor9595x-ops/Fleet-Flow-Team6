"""add_email_verification_fields_to_users

Revision ID: 7ebb6dab306e
Revises: 45fce1d17fd7
Create Date: 2026-08-14 19:11:34.744880

Adds email_verified, verification_token, and verification_token_expires
columns to the users table.  Existing users are set to email_verified=TRUE
so that development / test accounts continue to work without re-verifying.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7ebb6dab306e'
down_revision: Union[str, Sequence[str], None] = '45fce1d17fd7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add email verification columns to users table."""
    # Add columns only if they don't already exist (safe re-run)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = [c["name"] for c in inspector.get_columns("users")]

    if "email_verified" not in existing_columns:
        op.add_column(
            "users",
            sa.Column(
                "email_verified",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("TRUE"),  # existing users stay logged in
            ),
        )
        # Remove the server_default after backfill so new signups default to False
        op.alter_column("users", "email_verified", server_default=None)

    if "verification_token" not in existing_columns:
        op.add_column(
            "users",
            sa.Column("verification_token", sa.String(255), nullable=True),
        )

    if "verification_token_expires" not in existing_columns:
        op.add_column(
            "users",
            sa.Column("verification_token_expires", sa.DateTime(), nullable=True),
        )

    if "updated_at" not in existing_columns:
        op.add_column(
            "users",
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=True,
                server_default=sa.text("now()"),
                onupdate=sa.text("now()"),
            ),
        )


def downgrade() -> None:
    """Remove email verification columns from users table."""
    op.drop_column("users", "verification_token_expires")
    op.drop_column("users", "verification_token")
    op.drop_column("users", "email_verified")
    op.drop_column("users", "updated_at")

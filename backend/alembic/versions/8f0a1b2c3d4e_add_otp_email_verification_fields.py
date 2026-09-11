"""add_otp_email_verification_fields_to_users

Revision ID: 8f0a1b2c3d4e
Revises: 7ebb6dab306e
Create Date: 2026-08-17 18:29:00.000000

Adds is_email_verified, verification_otp, and verification_otp_expires_at
columns to the users table.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '8f0a1b2c3d4e'
down_revision: Union[str, Sequence[str], None] = '7ebb6dab306e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = [c["name"] for c in inspector.get_columns("users")]

    if "is_email_verified" not in existing_columns:
        op.add_column(
            "users",
            sa.Column(
                "is_email_verified",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("FALSE"),
            ),
        )
        if "email_verified" in existing_columns:
            op.execute("UPDATE users SET is_email_verified = email_verified WHERE email_verified IS TRUE")

    if "verification_otp" not in existing_columns:
        op.add_column(
            "users",
            sa.Column("verification_otp", sa.String(255), nullable=True),
        )

    if "verification_otp_expires_at" not in existing_columns:
        op.add_column(
            "users",
            sa.Column("verification_otp_expires_at", sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("users", "verification_otp_expires_at")
    op.drop_column("users", "verification_otp")
    op.drop_column("users", "is_email_verified")

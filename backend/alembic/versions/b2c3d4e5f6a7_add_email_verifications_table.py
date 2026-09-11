"""add email_verifications table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-11 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "email_verifications" not in existing_tables:
        op.create_table(
            'email_verifications',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('email', sa.String(100), nullable=False),
            sa.Column('otp_hash', sa.String(255), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
            sa.Column('attempts', sa.Integer(), nullable=False, server_default=sa.text('0')),
            sa.Column('verified', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
        )
        op.create_index('ix_email_verifications_email', 'email_verifications', ['email'])


def downgrade() -> None:
    op.drop_index('ix_email_verifications_email', table_name='email_verifications')
    op.drop_table('email_verifications')

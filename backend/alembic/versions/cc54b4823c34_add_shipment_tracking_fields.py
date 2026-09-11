"""add shipment tracking fields

Revision ID: cc54b4823c34
Revises: ea68f43167c0
Create Date: 2026-08-03 22:27:20.789527

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "cc54b4823c34"
down_revision: Union[str, Sequence[str], None] = "ea68f43167c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "shipments",
        sa.Column(
            "expected_delivery_time",
            sa.DateTime(),
            nullable=True
        )
    )

    op.add_column(
        "shipments",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=True
        )
    )


def downgrade() -> None:
    op.drop_column("shipments", "updated_at")
    op.drop_column("shipments", "expected_delivery_time")
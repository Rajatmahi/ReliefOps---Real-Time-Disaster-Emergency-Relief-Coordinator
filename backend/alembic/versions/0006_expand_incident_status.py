"""Allow the extended incident workflow statuses in PostgreSQL."""
from alembic import op
import sqlalchemy as sa

revision = "0006_expand_incident_status"
down_revision = "0005_coordinator_applications"
branch_labels = None
depends_on = None


def upgrade():
    # The initial migration sized these VARCHAR columns for the old longest
    # status (IN_PROGRESS, 11 chars). New lifecycle statuses are longer.
    op.alter_column(
        "incidents", "status",
        existing_type=sa.String(length=11),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
    for column, nullable in (("old_status", True), ("new_status", False)):
        op.alter_column(
            "incident_status_history", column,
            existing_type=sa.String(length=11),
            type_=sa.String(length=32),
            existing_nullable=nullable,
        )


def downgrade():
    # Keep the widened columns on downgrade: narrowing them could truncate
    # AWAITING_VERIFICATION values already written to operational history.
    pass

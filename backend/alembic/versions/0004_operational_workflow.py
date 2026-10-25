"""Add urgency indicators and verified assignment outcomes."""
from alembic import op
import sqlalchemy as sa

revision = "0004_operational_workflow"
down_revision = "0003_location_labels"
branch_labels = None
depends_on = None


def upgrade():
    # IncidentStatus is stored as VARCHAR (native_enum=False), so new lifecycle
    # values do not require a database enum rebuild.
    op.add_column("incidents", sa.Column("people_trapped", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("incidents", sa.Column("urgent_medical", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("incidents", sa.Column("immediate_needs", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("incidents", sa.Column("suggested_severity", sa.String(length=8), nullable=True))
    op.add_column("incidents", sa.Column("priority_reasons", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("incidents", sa.Column("priority_override_reason", sa.Text(), nullable=True))
    op.add_column("incidents", sa.Column("resolution_notes", sa.Text(), nullable=True))
    op.add_column("assignments", sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("assignments", sa.Column("outcome_notes", sa.Text(), nullable=True))
    op.add_column("incident_status_history", sa.Column("reason", sa.Text(), nullable=True))
    op.alter_column("incidents", "people_trapped", server_default=None)
    op.alter_column("incidents", "urgent_medical", server_default=None)
    op.alter_column("incidents", "immediate_needs", server_default=None)
    op.alter_column("incidents", "priority_reasons", server_default=None)


def downgrade():
    op.drop_column("incident_status_history", "reason")
    op.drop_column("assignments", "outcome_notes")
    op.drop_column("assignments", "arrived_at")
    for name in ("resolution_notes", "priority_override_reason", "priority_reasons", "suggested_severity", "immediate_needs", "urgent_medical", "people_trapped"):
        op.drop_column("incidents", name)

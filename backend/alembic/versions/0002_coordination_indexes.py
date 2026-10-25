"""Add indexes for coordinator and active assignment lookups."""
from alembic import op

revision = "0002_coordination_indexes"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_rescue_teams_availability", "rescue_teams", ["availability"])
    op.create_index("ix_rescue_teams_coordinator_id", "rescue_teams", ["coordinator_id"])
    op.create_index("ix_assignments_status", "assignments", ["status"])
    op.create_index("ix_assignments_incident_status", "assignments", ["incident_id", "status"])
    op.create_index("ix_assignments_team_status", "assignments", ["team_id", "status"])
    op.create_index("ix_status_history_incident_changed", "incident_status_history", ["incident_id", "changed_at"])


def downgrade():
    op.drop_index("ix_status_history_incident_changed", table_name="incident_status_history")
    op.drop_index("ix_assignments_team_status", table_name="assignments")
    op.drop_index("ix_assignments_incident_status", table_name="assignments")
    op.drop_index("ix_assignments_status", table_name="assignments")
    op.drop_index("ix_rescue_teams_coordinator_id", table_name="rescue_teams")
    op.drop_index("ix_rescue_teams_availability", table_name="rescue_teams")

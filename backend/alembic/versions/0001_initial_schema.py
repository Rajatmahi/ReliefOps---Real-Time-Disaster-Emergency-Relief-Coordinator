"""Create initial disaster coordination schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    role = sa.Enum("CITIZEN", "ADMIN", "COORDINATOR", name="role", native_enum=False)
    severity = sa.Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="severity", native_enum=False)
    incident_status = sa.Enum("REPORTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", name="incidentstatus", native_enum=False)
    op.create_table("users", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(120), nullable=False), sa.Column("email", sa.String(255), nullable=False), sa.Column("password_hash", sa.String(255), nullable=False), sa.Column("role", role, nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("email"))
    op.create_index("ix_users_email", "users", ["email"], unique=False)
    op.create_table("rescue_teams", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("team_name", sa.String(120), nullable=False, unique=True), sa.Column("capacity", sa.Integer(), nullable=False), sa.Column("availability", sa.String(20), nullable=False), sa.Column("coordinator_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")), sa.Column("current_latitude", sa.Numeric(9, 6)), sa.Column("current_longitude", sa.Numeric(9, 6)), sa.CheckConstraint("capacity > 0", name="ck_rescue_team_capacity"), sa.CheckConstraint("availability IN ('available', 'busy', 'offline')", name="ck_rescue_team_availability"))
    op.create_table("incidents", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("reporter_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("disaster_type", sa.String(60), nullable=False), sa.Column("description", sa.Text(), nullable=False), sa.Column("latitude", sa.Numeric(9, 6), nullable=False), sa.Column("longitude", sa.Numeric(9, 6), nullable=False), sa.Column("severity", severity, nullable=False), sa.Column("people_affected", sa.Integer(), nullable=False), sa.Column("status", incident_status, nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.CheckConstraint("latitude >= -90 AND latitude <= 90", name="ck_incident_latitude"), sa.CheckConstraint("longitude >= -180 AND longitude <= 180", name="ck_incident_longitude"), sa.CheckConstraint("people_affected >= 0", name="ck_incident_people_affected"))
    for name, cols in [("reporter_id", ["reporter_id"]), ("disaster_type", ["disaster_type"]), ("severity", ["severity"]), ("status", ["status"]), ("status_severity", ["status", "severity"])]:
        op.create_index(f"ix_incidents_{name}", "incidents", cols)
    op.create_table("assignments", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("incident_id", sa.Integer(), sa.ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=False), sa.Column("team_id", sa.Integer(), sa.ForeignKey("rescue_teams.id", ondelete="RESTRICT"), nullable=False), sa.Column("assigned_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False), sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("status", sa.String(20), nullable=False), sa.CheckConstraint("status IN ('active', 'active_in_progress', 'completed')", name="ck_assignment_status"))
    op.create_index("ix_assignments_incident_id", "assignments", ["incident_id"])
    op.create_index("ix_assignments_team_id", "assignments", ["team_id"])
    op.create_table("inventory", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("relief_center", sa.String(120), nullable=False), sa.Column("item_name", sa.String(120), nullable=False), sa.Column("quantity", sa.Integer(), nullable=False), sa.Column("last_updated", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("relief_center", "item_name", name="uq_inventory_center_item"), sa.CheckConstraint("quantity >= 0", name="ck_inventory_quantity_nonnegative"))
    op.create_table("inventory_transactions", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("inventory_id", sa.Integer(), sa.ForeignKey("inventory.id", ondelete="RESTRICT"), nullable=False), sa.Column("transaction_type", sa.String(20), nullable=False), sa.Column("quantity", sa.Integer(), nullable=False), sa.Column("recorded_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("notes", sa.Text()), sa.CheckConstraint("quantity > 0", name="ck_inventory_transaction_quantity"), sa.CheckConstraint("transaction_type IN ('received', 'distributed')", name="ck_inventory_transaction_type"))
    op.create_index("ix_inventory_transactions_inventory_id", "inventory_transactions", ["inventory_id"])
    op.create_table("incident_status_history", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("incident_id", sa.Integer(), sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False), sa.Column("old_status", incident_status), sa.Column("new_status", incident_status, nullable=False), sa.Column("changed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False), sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_incident_status_history_incident_id", "incident_status_history", ["incident_id"])

def downgrade():
    for table in ("incident_status_history", "inventory_transactions", "inventory", "assignments", "incidents", "rescue_teams", "users"):
        op.drop_table(table)

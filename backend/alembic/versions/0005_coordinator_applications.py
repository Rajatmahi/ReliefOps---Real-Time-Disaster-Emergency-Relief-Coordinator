"""Add an administrator-reviewed coordinator application workflow."""
from alembic import op
import sqlalchemy as sa

revision = "0005_coordinator_applications"
down_revision = "0004_operational_workflow"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "coordinator_applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("applicant_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("motivation", sa.Text(), nullable=False),
        sa.Column("experience", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_reason", sa.Text(), nullable=True),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_coordinator_application_status"),
    )
    op.create_index("ix_coordinator_applications_applicant_id", "coordinator_applications", ["applicant_id"])
    op.create_index("ix_coordinator_applications_status", "coordinator_applications", ["status"])
    op.create_index("ix_coordinator_applications_status_created", "coordinator_applications", ["status", "submitted_at"])
    op.alter_column("coordinator_applications", "status", server_default=None)


def downgrade():
    op.drop_index("ix_coordinator_applications_status_created", table_name="coordinator_applications")
    op.drop_index("ix_coordinator_applications_status", table_name="coordinator_applications")
    op.drop_index("ix_coordinator_applications_applicant_id", table_name="coordinator_applications")
    op.drop_table("coordinator_applications")

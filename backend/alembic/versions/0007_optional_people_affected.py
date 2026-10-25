"""Allow reports to omit an affected-person estimate."""
from alembic import op
import sqlalchemy as sa

revision = "0007_optional_people_affected"
down_revision = "0006_expand_incident_status"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "incidents", "people_affected",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade():
    # Restore the old default only when rolling back to the non-optional form.
    op.execute("UPDATE incidents SET people_affected = 1 WHERE people_affected IS NULL")
    op.alter_column(
        "incidents", "people_affected",
        existing_type=sa.Integer(),
        nullable=False,
    )

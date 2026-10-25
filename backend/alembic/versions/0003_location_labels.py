"""Store searchable place labels alongside map coordinates."""
from alembic import op
import sqlalchemy as sa

revision = "0003_location_labels"
down_revision = "0002_coordination_indexes"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("incidents", sa.Column("location_label", sa.String(length=255), nullable=True))
    op.add_column("rescue_teams", sa.Column("location_label", sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column("rescue_teams", "location_label")
    op.drop_column("incidents", "location_label")

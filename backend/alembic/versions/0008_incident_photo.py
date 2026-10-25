"""Store an optional photo with each incident."""
from alembic import op
import sqlalchemy as sa

revision = "0008_incident_photo"
down_revision = "0007_optional_people_affected"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("incidents", sa.Column("photo_data", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("incidents", "photo_data")

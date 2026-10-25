"""Allow up to five photos on an incident."""
from alembic import op
import sqlalchemy as sa

revision = "0009_multiple_incident_photos"
down_revision = "0008_incident_photo"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "incidents",
        sa.Column("photos_data", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )
    op.execute(
        "UPDATE incidents SET photos_data = json_build_array(photo_data) "
        "WHERE photo_data IS NOT NULL AND photo_data <> ''"
    )


def downgrade():
    op.drop_column("incidents", "photos_data")

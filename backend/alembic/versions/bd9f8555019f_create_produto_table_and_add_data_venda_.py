"""create produto table and add data_venda to carne

Revision ID: bd9f8555019f
Revises: f37e707c1454
Create Date: 2025-06-04 20:14:00.789170

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bd9f8555019f'
down_revision: Union[str, None] = 'f37e707c1454'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

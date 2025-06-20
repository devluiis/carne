"""Add observacoes column to parcela

Revision ID: b50a1052d873
Revises: 6ccedb5996a0
Create Date: 2025-06-11 09:05:11.701443

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b50a1052d873'
down_revision: Union[str, None] = '6ccedb5996a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column('pagamento', 'data_pagamento',
               existing_type=postgresql.TIMESTAMP(),
               nullable=False)
    op.add_column('parcela', sa.Column('observacoes', sa.String(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('parcela', 'observacoes')
    op.alter_column('pagamento', 'data_pagamento',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True)
    # ### end Alembic commands ###

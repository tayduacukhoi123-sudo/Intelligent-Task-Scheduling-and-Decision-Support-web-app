"""safe add is_notified and tags columns

Revision ID: 9999_safe_add
Revises: 8bea20abaef4
Create Date: 2026-04-19 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = '9999_safe_add'
down_revision = '8bea20abaef4'
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade():
    # Only add columns if they don't exist
    if not column_exists('task', 'tags'):
        with op.batch_alter_table('task', schema=None) as batch_op:
            batch_op.add_column(sa.Column('tags', sa.Text(), nullable=True))
    
    if not column_exists('task', 'is_notified'):
        with op.batch_alter_table('task', schema=None) as batch_op:
            batch_op.add_column(sa.Column('is_notified', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('task', schema=None) as batch_op:
        if column_exists('task', 'is_notified'):
            batch_op.drop_column('is_notified')
        if column_exists('task', 'tags'):
            batch_op.drop_column('tags')

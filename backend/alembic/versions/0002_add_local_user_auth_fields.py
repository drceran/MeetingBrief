"""add local user auth fields

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-17 00:00:00.000000
"""

from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


users_table = sa.table(
    "users",
    sa.column("id", sa.Integer()),
    sa.column("auth_user_id", sa.String(length=36)),
)


def upgrade() -> None:
    op.add_column("users", sa.Column("auth_user_id", sa.String(length=36), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=512), nullable=True))
    op.add_column("users", sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True))

    bind = op.get_bind()
    rows = list(bind.execute(sa.select(users_table.c.id)))
    for row in rows:
        bind.execute(
            users_table.update()
            .where(users_table.c.id == row.id)
            .values(auth_user_id=str(uuid4()))
        )

    op.alter_column("users", "auth_user_id", nullable=False)
    op.create_index(op.f("ix_users_auth_user_id"), "users", ["auth_user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_auth_user_id"), table_name="users")
    op.drop_column("users", "created_at")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "auth_user_id")

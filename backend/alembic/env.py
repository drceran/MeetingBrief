from __future__ import annotations

import logging
import re
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

import models

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
fileConfig(config.config_file_name or "")
logger = logging.getLogger("alembic.env")

# add your model's MetaData object here for 'autogenerate' support
# target_metadata = mymodel.Base.metadata
target_metadata = models.Base.metadata


def process_revision_directives(context, revision, directives):
    script_directory = context.opts['revision_context'].script_directory
    head_revision_id = script_directory.get_current_head()
    revision_num = 1
    if head_revision_id:
        head_revision_obj = script_directory.get_revision(head_revision_id)
        head_revision_prefix, head_revision_name = (
            Path(head_revision_obj.path).name.split('_', 1)
        )
        head_revision_num = re.findall(r"^(\d+)", head_revision_prefix)
        head_revision_num = (
            int(head_revision_num[0]) if head_revision_num else 0
        )
        revision_num = head_revision_num + 1
    revision_num_str = "0"*(4-len(str(revision_num))) + f"{revision_num}"
    file_template_parts = script_directory.file_template.split('_', 1)
    if re.findall(r"^\d+", file_template_parts[0]):
        file_template = f"{revision_num_str}_{file_template_parts[1]}"
    else:
        file_template = f"{revision_num_str}_{script_directory.file_template}"
    script_directory.file_template = file_template


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation we
    don't even need a DBAPI to be available.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        process_revision_directives=process_revision_directives,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            process_revision_directives=process_revision_directives,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

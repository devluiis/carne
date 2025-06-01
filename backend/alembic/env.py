from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# >>> ADICIONAR ESTAS DUAS LINHAS <<<
from app.database import Base
from app.config import DATABASE_URL # Importe a DATABASE_URL para usar diretamente
# >>> FIM DAS LINHAS A SEREM ADICIONADAS <<<

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
# >>> MODIFICAR A LINHA ABAIXO <<<
target_metadata = Base.metadata # Era 'None', agora aponta para a metadata da sua Base
# >>> FIM DA MODIFICAÇÃO <<<

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    # >>> MODIFICAR A LINHA ABAIXO para usar DATABASE_URL diretamente <<<
    url = DATABASE_URL # Usar a variável importada do seu config.py
    # >>> FIM DA MODIFICAÇÃO <<<
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # >>> ADICIONAR A LINHA ABAIXO para definir o URL no config antes de engine_from_config <<<
    config.set_main_option("sqlalchemy.url", DATABASE_URL)
    # >>> FIM DA LINHA A SER ADICIONADA <<<
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
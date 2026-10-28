"""Existing development databases can have a new table but an old play_plans table."""

import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text

from app.models import PlayCategory


@pytest.mark.parametrize("category_table_exists", [False, True])
def test_category_migration_backfills_old_plans_when_schema_is_partial(category_table_exists):
    path = Path(__file__).parents[1] / "alembic/versions/0033_play_categories.py"
    spec = importlib.util.spec_from_file_location("play_categories_migration", path)
    assert spec and spec.loader
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)"))
        connection.execute(text(
            "CREATE TABLE play_plans (id VARCHAR(36) PRIMARY KEY, name VARCHAR(160) UNIQUE NOT NULL, "
            "slug VARCHAR(180) UNIQUE NOT NULL, sort_order INTEGER NOT NULL, "
            "created_by_id VARCHAR(36), created_by_label VARCHAR(120))"
        ))
        connection.execute(text(
            "INSERT INTO play_plans VALUES "
            "('p1', 'Pinch & Grip Development', 'pinch-grip-development', 0, NULL, 'Esther'), "
            "('p2', 'Custom Plan', 'custom-plan', 1, NULL, 'Admin')"
        ))
        if category_table_exists:
            PlayCategory.__table__.create(connection)
            connection.execute(text(
                "INSERT INTO play_categories (id, name, sort_order) "
                "VALUES ('existing', 'Pinch & Grip Development', 0)"
            ))

        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()

        rows = connection.execute(text(
            "SELECT p.id, p.name, c.id, c.name FROM play_plans p "
            "JOIN play_categories c ON c.id = p.category_id ORDER BY p.sort_order"
        )).all()
        assert len(rows) == 2
        assert rows[0][1] == "Fix the Pencil Grip"
        assert rows[0][3] == "Pinch & Grip Development"
        assert rows[1][1] == rows[1][3] == "Custom Plan"
        if category_table_exists:
            assert rows[0][2] == "existing"
        assert any(
            foreign_key["referred_table"] == "play_categories"
            for foreign_key in inspect(connection).get_foreign_keys("play_plans")
        )

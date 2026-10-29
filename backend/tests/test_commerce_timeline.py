from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.commerce.models import Control
from app.commerce.repository import CommerceRepository
from app.commerce.timeline import timeline_start, validate_timeline


@pytest.mark.parametrize(("window", "bucket"), [(300, 10), (900, 60)])
def test_supported_timeline_modes(window, bucket):
    validate_timeline(window, bucket)


@pytest.mark.parametrize(("window", "bucket"), [(300, 60), (900, 10), (60, 10), (300, 0)])
def test_unsupported_timeline_modes_fail(window, bucket):
    with pytest.raises(ValueError):
        validate_timeline(window, bucket)


def test_ten_second_window_has_thirty_half_open_buckets():
    now = datetime(2026, 10, 28, 11, 44, 19, tzinfo=UTC)
    assert timeline_start(now, 300, 10) == datetime(2026, 10, 28, 11, 39, 20, tzinfo=UTC)


def test_exact_bucket_boundary_starts_a_new_bucket():
    now = datetime(2026, 10, 28, 11, 44, 20, tzinfo=UTC)
    assert timeline_start(now, 300, 10) == datetime(2026, 10, 28, 11, 39, 30, tzinfo=UTC)


def test_existing_minute_window_is_preserved():
    now = datetime(2026, 10, 28, 11, 44, 19, tzinfo=UTC)
    assert timeline_start(now, 900, 60) == datetime(2026, 10, 28, 11, 30, tzinfo=UTC)


@pytest.mark.asyncio
async def test_resume_preserves_scene_and_same_scene_does_not_duplicate_markers(live_settings):
    class Connection:
        def __init__(self):
            self.run = {
                "id": uuid4(), "status": "paused", "scene": "recovery", "seed": 42,
                "sequence": 3, "created_at": datetime.now(UTC), "error": None,
            }
            self.markers = []

        @asynccontextmanager
        async def transaction(self):
            yield

        async def execute(self, query, params=None):
            if query.startswith("INSERT INTO commerce.markers"):
                self.markers.append(params)
            if "UPDATE commerce.runs SET status=" in query:
                self.run["status"] = params[0]
            if "UPDATE commerce.runs SET scene=" in query:
                self.run["scene"] = params[0]
            return self

        async def fetchone(self):
            return self.run.copy()

    conn = Connection()

    class Pool:
        @asynccontextmanager
        async def connection(self):
            yield conn

    repository = CommerceRepository(live_settings)
    repository.pool = Pool()
    resumed = await repository.control(Control(action="start"))
    assert resumed.scene == "recovery"
    assert conn.markers == []
    await repository.control(Control(action="scene", scene="normal"))
    await repository.control(Control(action="scene", scene="normal"))
    assert len(conn.markers) == 1
    assert conn.markers[0][2] == "normal"

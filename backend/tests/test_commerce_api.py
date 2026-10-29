from datetime import UTC, datetime
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.commerce.models import Snapshot
from app.commerce.repository import CommerceConflict
from app.commerce.routes import router
from app.config import Settings
from app.main import create_app


class SnapshotRepository:
    async def snapshot(self, window_seconds=60, topic=None, timeline_seconds=900, bucket_seconds=60):
        return Snapshot(
            as_of=datetime.now(UTC), window_seconds=window_seconds, run=None,
            model_alias="test-only",
            timeline_seconds=timeline_seconds, bucket_seconds=bucket_seconds,
        )


def test_query_windows_and_reject_invalid_values():
    app = FastAPI()
    app.include_router(router)
    app.state.commerce = SimpleNamespace(repository=SnapshotRepository())
    with TestClient(app) as client:
        for seconds in (60, 300):
            response = client.get(f"/api/commerce/snapshot?window_seconds={seconds}")
            assert response.status_code == 200, response.text
            assert response.json()["window_seconds"] == seconds
        assert client.get("/api/commerce/snapshot?window_seconds=90").status_code == 422
        assert client.get("/api/commerce/snapshot?topic=unrecognized").status_code == 422
        for timeline, bucket in ((300, 10), (900, 60)):
            response = client.get(
                f"/api/commerce/snapshot?timeline_seconds={timeline}&bucket_seconds={bucket}",
            )
            assert response.status_code == 200
            assert response.json()["bucket_seconds"] == bucket
        for query in ("timeline_seconds=300&bucket_seconds=60", "bucket_seconds=0"):
            assert client.get(f"/api/commerce/snapshot?{query}").status_code == 422


def test_disabled_shopping_is_explicit_and_does_not_break_fleet(
    live_settings: Settings, fake_repository, fake_agent_client,
):
    settings = live_settings.model_copy(update={"commerce_enabled": False})
    app = create_app(settings, repository=fake_repository, agent_client=fake_agent_client)
    with TestClient(app) as client:
        assert client.get("/api/shipments").status_code == 200
        response = client.get("/api/commerce/snapshot")
        assert response.status_code == 503
        assert "COMMERCE_ENABLED" in response.json()["detail"]


def test_manual_briefing_errors_are_not_success_responses():
    class FailingRepository:
        async def generate_briefing(self):
            raise RuntimeError("model timeout")

    class NoRunRepository:
        async def generate_briefing(self):
            raise CommerceConflict("먼저 데모를 시작해 주세요.")

    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        app.state.commerce = SimpleNamespace(repository=FailingRepository())
        assert client.post("/api/commerce/briefing").status_code == 502
        app.state.commerce = SimpleNamespace(repository=NoRunRepository())
        assert client.post("/api/commerce/briefing").status_code == 409

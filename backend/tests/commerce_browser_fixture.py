"""Loopback-only UI fixture: no database, model calls, or production fallback."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Literal
from uuid import uuid4

from conftest import FakeShipmentRepository
from fastapi import FastAPI, HTTPException

from app.commerce.models import (
    Analysis,
    Briefing,
    BriefingResult,
    Classification,
    CommentView,
    Control,
    Marker,
    Metrics,
    RecentOrder,
    Run,
    Snapshot,
    TopicCount,
    Trend,
)
from app.commerce.routes import router
from app.commerce.timeline import timeline_start

now = datetime.now(UTC)


class FixtureRepository:
    def __init__(self):
        self.fail = False
        self.timeline_case = "mixed"
        self.actions = []
        self.run = Run(
            id=uuid4(), status="paused", scene="normal", seed=42, sequence=10, created_at=now,
        )
        self.markers = []

    async def control(self, command: Control):
        self.actions.append(command.model_dump())
        if command.action == "start":
            self.run.status = "running"
        elif command.action == "pause":
            self.run.status = "paused"
        elif command.action == "scene":
            self.run.scene = command.scene
            self.markers.append(Marker(
                created_at=datetime.now(UTC), note=command.scene,
                kind="scene", scene=command.scene,
            ))
        elif command.action == "notice":
            self.run.scene = "recovery"
            self.markers.append(Marker(
                created_at=datetime.now(UTC), note=command.notice, scene="recovery",
            ))
        return self.run

    async def snapshot(self, window_seconds=60, topic=None, timeline_seconds=900, bucket_seconds=60):
        if self.fail:
            raise HTTPException(status_code=503, detail="UI TEST: connection interrupted")
        as_of = datetime.now(UTC)
        chart_start = timeline_start(as_of, timeline_seconds, bucket_seconds)
        points = []
        for index in range(timeline_seconds//bucket_seconds):
            point = Trend(
                minute=chart_start+timedelta(seconds=index*bucket_seconds),
                orders=index % 5,
                negative=1 if index % 5 == 2 else 0,
                classified=4 if index % 5 in (2, 3) else 0,
                comments=4 if index % 5 else 0,
                pending=4 if index % 5 == 1 else 0,
                failed=4 if index % 5 == 4 else 0,
            )
            if self.timeline_case != "mixed":
                point.comments = point.pending = point.failed = point.classified = point.negative = 0
                if self.timeline_case == "isolated" and index == timeline_seconds//bucket_seconds//2:
                    point.comments = point.classified = 3
                elif self.timeline_case == "pending" and index == timeline_seconds//bucket_seconds-1:
                    point.comments = point.pending = 1
            points.append(point)
        return Snapshot(
            as_of=as_of, window_seconds=window_seconds, run=self.run,
            model_alias="UI-test-fixture-not-a-real-model",
            timeline_seconds=timeline_seconds, bucket_seconds=bucket_seconds,
            metrics=Metrics(
                received=12, paid=10, gross=990000, cancelled=1, cancelled_amount=99000,
                net=9, net_amount=891000, last_minute=10, channels={"app": 6, "phone": 3, "web": 1},
            ),
            analysis=Analysis(
                total=22, classified=20, positive=6, neutral=4, negative=10,
                pending=1, failed=1, shipping_count=12, alert=True, oldest_pending_seconds=8,
            ),
            topics=[TopicCount(topic="배송", count=12), TopicCount(topic="용량", count=3)],
            comments=[] if topic == "용량" else [CommentView(
                comment_id="fixture-1", run_id=self.run.id, created_at=now,
                content="배송 안내가 없어서 답답해요. 언제 오나요?", status="completed",
                classification=Classification(
                    sentiment="negative", intents=["질문", "불만"], topics=["배송"],
                    evidence="답답해요",
                ), analyzed_at=now,
            )],
            trend=points,
            markers=[marker for marker in self.markers if (
                datetime.now(UTC)-timedelta(seconds=timeline_seconds)
            ) <= marker.created_at < datetime.now(UTC)],
            recent_orders=[RecentOrder(order_id=10, channel="app", paid_at=now, cancelled_at=None)],
            briefing=Briefing(
                status="completed", requested_at=now, data_as_of=now, completed_at=now,
                result=BriefingResult(
                    summary="배송 문의가 늘고 있습니다.",
                    suggestion="확인된 출고 일정을 안내하세요.", evidence_ids=["fixture-1"],
                ),
            ),
        )


repository = FixtureRepository()
fleet = FakeShipmentRepository()
app = FastAPI()
app.state.commerce = SimpleNamespace(repository=repository)
app.include_router(router)


@app.get("/api/shipments")
async def shipments():
    return await fleet.list_shipments()


@app.get("/api/shipments/stats")
async def stats():
    return await fleet.stats()


@app.get("/api/health")
async def health():
    return await fleet.capabilities()


@app.post("/__test/failure/{enabled}")
async def failure(enabled: bool):
    repository.fail = enabled
    return {"failure": enabled}


@app.get("/__test/actions")
async def actions():
    return repository.actions


@app.post("/__test/timeline/{case}")
async def timeline_case(case: Literal["mixed", "isolated", "empty", "pending"]):
    repository.timeline_case = case
    return {"case": case}

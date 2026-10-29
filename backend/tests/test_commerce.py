from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.commerce.models import Classification, OrderEvent, project_order, shipping_alert
from app.commerce.repository import CommerceRepository
from app.commerce.simulator import make_tick


def event(kind: str, offset: int = 0) -> OrderEvent:
    return OrderEvent(
        run_id=uuid4(), event_id=f"event-{kind}", order_id=1,
        kind=kind, occurred_at=datetime(2026, 10, 28, tzinfo=UTC) + timedelta(seconds=offset),
        channel="app", amount=99000,
    )


def test_order_projection_preserves_payment_after_out_of_order_cancellation():
    paid, cancelled = event("paid"), event("cancelled", 10)
    state = project_order([cancelled, paid, paid])
    assert state.paid_at == paid.occurred_at
    assert state.cancelled_at == cancelled.occurred_at
    assert state.amount == 99000


def test_order_projection_rejects_conflicting_event_ids():
    paid = event("paid")
    conflict = paid.model_copy(update={"kind": "cancelled"})
    with pytest.raises(ValueError, match="conflicting"):
        project_order([paid, conflict])


def test_classification_has_independent_sentiment_intents_and_topics():
    label = Classification.model_validate({
        "sentiment": "negative", "intents": ["질문", "불만"],
        "topics": ["배송"], "evidence": "안내가 없어서 답답해요",
    })
    assert label.sentiment == "negative"
    assert label.intents == ["질문", "불만"]
    with pytest.raises(ValidationError):
        Classification.model_validate({
            "sentiment": "happy", "intents": [], "topics": [], "evidence": "x",
        })


@pytest.mark.parametrize("evidence", [
    '"바삭하게 잘 익는 모습이 마음에 들어요"',
    "“바삭하게 잘 익는 모습이 마음에 들어요”",
])
def test_classification_accepts_quoted_verbatim_evidence(evidence):
    content = "바삭하게 잘 익는 모습이 마음에 들어요"
    label = Classification(
        sentiment="positive", intents=["감상"], topics=["조리 결과"], evidence=evidence,
    )
    assert label.verify_evidence(content).evidence == content


def test_classification_rejects_invented_evidence():
    label = Classification(
        sentiment="positive", intents=["감상"], topics=["조리 결과"], evidence='"없는 문장"',
    )
    with pytest.raises(ValueError, match="원문"):
        label.verify_evidence("바삭해서 좋아요")


def test_synthetic_ticks_are_seeded_and_do_not_contain_sentiment_answers():
    run = uuid4()
    now = datetime(2026, 10, 28, tzinfo=UTC)
    first = make_tick(run, 6, "shipping", now, 42)
    assert first == make_tick(run, 6, "shipping", now, 42)
    assert first.comment is not None
    assert "sentiment" not in first.comment.model_dump()
    assert first.comment.run_id == run


def test_scene_generation_changes_new_events_only():
    run = uuid4()
    now = datetime(2026, 10, 28, tzinfo=UTC)
    normal = [make_tick(run, i, "normal", now, 42) for i in range(60)]
    shipping = [make_tick(run, i, "shipping", now, 42) for i in range(60)]
    assert sum(bool(t.orders) for t in normal) > sum(bool(t.orders) for t in shipping)
    assert any(t.comment and "배송" in t.comment.content for t in shipping)


@pytest.mark.parametrize(("classified", "negative", "shipping", "expected"), [
    (19, 19, 19, False), (20, 7, 10, False), (20, 8, 9, False),
    (20, 8, 10, True), (0, 0, 0, False),
])
def test_shipping_alert_boundaries(classified, negative, shipping, expected):
    assert shipping_alert(classified, negative, shipping) is expected


@pytest.mark.asyncio
async def test_invalid_pipeline_output_persists_failure_without_neutral_fallback(live_settings):
    class Connection:
        def __init__(self):
            self.writes = []

        @asynccontextmanager
        async def transaction(self):
            yield

        async def execute(self, query, params=None):
            if query.startswith("INSERT"):
                self.writes.append(params)
            return self

        async def fetchall(self):
            return [{
                "batch_id": uuid4(), "run_id": uuid4(), "generated_text": "not valid json",
                "members": [{
                    "comment_id": "test", "content": "배송은 언제 오나요?",
                    "source_version": datetime.now(UTC).isoformat(),
                }],
            }]

    connection = Connection()

    class Pool:
        @asynccontextmanager
        async def connection(self):
            yield connection

    repository = CommerceRepository(live_settings)
    repository.pool = Pool()
    await repository.reconcile()
    assert len(connection.writes) == 1
    assert connection.writes[0][0] is None
    assert "묶음 분류 출력 검증 실패" in connection.writes[0][1]

import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.commerce.batching import enqueue_ready, reconcile_batches
from app.commerce.models import BatchMember, batch_ready, validate_batch
from app.commerce.repository import CommerceRepository

NOW = datetime(2026, 10, 28, tzinfo=UTC)


@pytest.mark.parametrize(("count", "age", "expected"), [
    (0, 10, False), (1, 4.999, False), (9, 4.999, False),
    (1, 5, True), (9, 5, True), (10, 0, True), (11, 0, True),
])
def test_batch_count_and_oldest_deadline(count, age, expected):
    assert batch_ready(count, NOW - timedelta(seconds=age), NOW) is expected


def members():
    return [
        BatchMember(comment_id="a", content="배송 안내가 없어서 답답해요", source_version=NOW),
        BatchMember(comment_id="b", content="바삭해서 좋아요", source_version=NOW),
    ]


def output():
    return {"results": [
        {"comment_id": "b", "classification": {
            "sentiment": "positive", "intents": ["감상"], "topics": ["조리 결과"],
        }},
        {"comment_id": "a", "classification": {
            "sentiment": "negative", "intents": ["질문", "불만"], "topics": ["배송"],
        }},
    ]}


def test_batch_uses_ids_not_response_positions():
    result = validate_batch(json.dumps(output()), members())
    assert result["a"].sentiment == "negative"
    assert result["b"].sentiment == "positive"
    assert result["b"].evidence == "바삭해서 좋아요"


@pytest.mark.parametrize("kind", ["missing", "duplicate", "invented", "evidence", "json"])
def test_batch_rejects_malformed_or_misattributed_results(kind):
    data = output()
    if kind == "missing":
        data["results"].pop()
    elif kind == "duplicate":
        data["results"][0]["comment_id"] = "a"
    elif kind == "invented":
        data["results"][0]["comment_id"] = "not-in-input"
    elif kind == "evidence":
        data["results"][0]["classification"]["evidence"] = "다른 댓글"
    raw = "invalid json" if kind == "json" else json.dumps(data)
    with pytest.raises(ValueError):
        validate_batch(raw, members())


def test_continuous_arrivals_do_not_restart_the_oldest_deadline():
    first = NOW - timedelta(seconds=5)
    assert batch_ready(3, first, NOW)
    assert not batch_ready(3, NOW - timedelta(seconds=1), NOW)


def test_batch_links_quoted_original_text_without_model_generated_evidence():
    original = '배송 설명도 없이 "구매"하라니 답답하네요'
    member = BatchMember(comment_id="quoted", content=original, source_version=NOW)
    raw = json.dumps({"results": [{
        "comment_id": "quoted",
        "classification": {"sentiment": "negative", "intents": ["불만"], "topics": ["배송"]},
    }]})
    assert validate_batch(raw, [member])["quoted"].evidence == original


@pytest.mark.asyncio
async def test_tick_lock_allows_batch_foreign_key_checks(live_settings):
    queries = []

    class Connection:
        @asynccontextmanager
        async def transaction(self):
            yield

        async def execute(self, query):
            queries.append(query)
            return self

        async def fetchone(self):
            return None

    class Pool:
        @asynccontextmanager
        async def connection(self):
            yield Connection()

    repository = CommerceRepository(live_settings)
    repository.pool = Pool()
    await repository.tick()
    assert queries == ["SELECT * FROM commerce.runs WHERE active FOR NO KEY UPDATE"]


@pytest.mark.asyncio
@pytest.mark.parametrize(("size", "age", "expected"), [
    (9, 4.999, 0), (1, 5, 1), (10, 0, 1),
])
async def test_ready_queue_creates_one_multi_comment_input(size, age, expected):
    class Connection:
        def __init__(self):
            self.writes = []
            self.reads = 0

        async def execute(self, query, params=None):
            if query.startswith(("INSERT", "UPDATE")):
                self.writes.append((query, params))
            return self

        async def fetchall(self):
            self.reads += 1
            if self.reads > 1:
                return []
            return [{
                "comment_id": f"comment-{index}", "content": "배송은 언제 오나요?",
                "source_version": NOW - timedelta(seconds=age), "checked_at": NOW,
            } for index in range(size)]

    conn = Connection()
    assert await enqueue_ready(conn, uuid4()) == expected
    inserts = [params for query, params in conn.writes if query.startswith("INSERT")]
    assert len(inserts) == expected
    if expected:
        content = json.loads(inserts[0][2])
        assert len(content["comments"]) == size
        assert {item["comment_id"] for item in content["comments"]} == {
            f"comment-{index}" for index in range(size)
        }
        assert all("sentiment" not in item for item in content["comments"])
        assignment = next(params for query, params in conn.writes if query.startswith("UPDATE"))
        assert assignment[0] == inserts[0][0]
        assert len(assignment[1]) == size


@pytest.mark.asyncio
async def test_batch_fanout_maps_reordered_results_to_original_ids():
    class Connection:
        def __init__(self):
            self.writes = []

        async def execute(self, query, params=None):
            if query.startswith("INSERT"):
                self.writes.append(params)
            return self

        async def fetchall(self):
            return [{
                "batch_id": uuid4(), "run_id": uuid4(),
                "members": [item.model_dump(mode="json") for item in members()],
                "generated_text": json.dumps(output()),
            }]

    conn = Connection()
    await reconcile_batches(conn, "test-model")
    labels = {params[4]: params[0].obj for params in conn.writes}
    assert labels["a"]["sentiment"] == "negative"
    assert labels["b"]["sentiment"] == "positive"
    assert all(params[1] is None for params in conn.writes)

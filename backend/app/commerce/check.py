"""Explicit live integration check using synthetic data and actual model calls."""

import argparse
import asyncio
import json
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from math import ceil
from uuid import uuid4

from app.commerce.batching import SINK_ACTION
from app.commerce.models import Comment, Control, OrderEvent
from app.commerce.repository import CommerceRepository
from app.commerce.simulator import COMMENTS
from app.config import Settings


async def check_timeline(settings: Settings) -> dict:
    repository = CommerceRepository(settings)
    await repository.open()
    reports = []
    try:
        for seconds, bucket in ((300, 10), (900, 60)):
            snapshot = await repository.snapshot(300, None, seconds, bucket)
            if snapshot.run is None:
                raise RuntimeError("A demo run is required for read-only timeline verification")
            assert len(snapshot.trend) == seconds // bucket
            starts = [point.minute for point in snapshot.trend]
            assert all((right-left).total_seconds() == bucket for left, right in pairwise(starts))
            assert all(starts[0] <= marker.created_at < snapshot.as_of for marker in snapshot.markers)
            assert all(
                point.comments == point.classified+point.pending+point.failed+point.unknown
                and point.negative <= point.classified for point in snapshot.trend
            )
            async with repository.pool.connection() as conn:
                cursor = await conn.execute(
                    "SELECT count(*) AS total FROM commerce.orders "
                    "WHERE run_id=%s AND paid_at>=%s AND paid_at<%s",
                    (snapshot.run.id, starts[0], snapshot.as_of),
                )
                assert (await cursor.fetchone())["total"] == sum(point.orders for point in snapshot.trend)
                cursor = await conn.execute(
                    "SELECT count(*) AS total FROM commerce.comments "
                    "WHERE run_id=%s AND created_at>=%s AND created_at<%s",
                    (snapshot.run.id, starts[0], snapshot.as_of),
                )
                assert (await cursor.fetchone())["total"] == sum(point.comments for point in snapshot.trend)
            reports.append({
                "window_seconds": seconds, "bucket_seconds": bucket, "buckets": len(starts),
                "orders": sum(point.orders for point in snapshot.trend),
                "comments": sum(point.comments for point in snapshot.trend),
                "visible_markers": len(snapshot.markers),
            })
        async with repository.pool.connection() as conn:
            cursor = await conn.execute(
                "WITH inputs(at) AS (VALUES ('2026-10-28T11:00:00Z'::timestamptz),"
                "('2026-10-28T11:00:09.999Z'::timestamptz),"
                "('2026-10-28T11:00:10Z'::timestamptz),"
                "('2026-10-28T11:00:19.999Z'::timestamptz),"
                "('2026-10-28T11:00:20Z'::timestamptz)) "
                "SELECT date_bin(interval '10 seconds',at,'1970-01-01'::timestamptz) AS bucket,"
                "count(*) AS n FROM inputs GROUP BY 1 ORDER BY 1"
            )
            assert [row["n"] for row in await cursor.fetchall()] == [2, 2, 1]
        return {"timeline_modes": reports, "exact_boundary_counts": [2, 2, 1], "read_only": True}
    finally:
        await repository.close()


async def check(settings: Settings, samples: int = 20, isolate_paused_run: bool = False) -> dict:
    repository = CommerceRepository(settings)
    await repository.open()
    test_runs = []
    preserved_run = None
    try:
        before = await repository.snapshot()
        if before.run:
            if not isolate_paused_run or before.run.status != "paused":
                raise RuntimeError("An existing demo run is active. Do not overwrite another demonstration.")
            preserved_run = before.run.id
            async with repository.pool.connection() as conn:
                await conn.execute(
                    "UPDATE commerce.runs SET active=false WHERE id=%s", (preserved_run,),
                )
        old = await repository.control(Control(action="reset"))
        test_runs.append(old.id)
        async with repository.pool.connection() as holder, holder.transaction():
            await holder.execute(
                "SELECT id FROM commerce.runs WHERE id=%s FOR NO KEY UPDATE", (old.id,),
            )
            async with repository.pool.connection() as checker, checker.transaction():
                await checker.execute(
                    "SELECT id FROM commerce.runs WHERE id=%s FOR KEY SHARE NOWAIT", (old.id,),
                )
        now = datetime.now(UTC) - timedelta(seconds=2)
        async with repository.pool.connection() as conn:
            version_id = uuid4()
            for version, text in ((now, "newer"), (now-timedelta(seconds=1), "older")):
                await conn.execute(
                    "INSERT INTO commerce.batch_results "
                    "(batch_id,run_id,created_at,content,members,updated_at,generated_text) "
                    "VALUES(%s,%s,%s,'explicit SQL regression fixture','[]'::jsonb,%s,%s) "
                    "ON CONFLICT(batch_id) " + SINK_ACTION,
                    (version_id, old.id, now, version, text),
                )
            cursor = await conn.execute(
                "SELECT generated_text FROM commerce.batch_results WHERE batch_id=%s",
                (version_id,),
            )
            assert (await cursor.fetchone())["generated_text"] == "newer"
        paid = OrderEvent(
            run_id=old.id, event_id=f"{old.id}:paid", order_id=1,
            kind="paid", occurred_at=now, channel="app",
        )
        cancelled = paid.model_copy(update={
            "event_id": f"{old.id}:cancelled", "kind": "cancelled",
            "occurred_at": now + timedelta(seconds=1),
        })
        await repository.ingest_order(cancelled)
        await repository.ingest_order(paid)
        await repository.ingest_order(paid)
        snapshot = await repository.snapshot()
        assert snapshot.metrics.paid == 1
        assert snapshot.metrics.cancelled == 1
        assert snapshot.metrics.gross == 99000
        assert snapshot.metrics.net_amount == 0
        assert sum(snapshot.metrics.channels.values()) == 1
        assert sum(point.orders for point in snapshot.trend) == 1
        partial = Comment(
            comment_id=f"{old.id}:partial", run_id=old.id, created_at=datetime.now(UTC),
            content="배송 일정이 언제인가요?",
        )
        await repository.ingest_comment(partial)
        assert await repository.enqueue_batches() == 0
        await asyncio.sleep(5)
        counts = await asyncio.gather(repository.enqueue_batches(), repository.enqueue_batches())
        assert sum(counts) == 1
        async with repository.pool.connection() as conn:
            cursor = await conn.execute(
                "SELECT jsonb_array_length(members) AS size,"
                "extract(epoch FROM(created_at-(members->0->>'source_version')::timestamptz))"
                " AS collection_seconds FROM commerce.analysis_batches WHERE run_id=%s", (old.id,),
            )
            partial_batch = await cursor.fetchone()
        assert partial_batch["size"] == 1
        assert partial_batch["collection_seconds"] >= 5
        fresh = await repository.control(Control(action="reset"))
        test_runs.append(fresh.id)
        assert fresh.id != old.id
        assert (await repository.snapshot()).metrics.paid == 0
        await repository.ingest_order(paid)
        assert (await repository.snapshot()).metrics.paid == 0
        pool = tuple(content for scene in COMMENTS.values() for content in scene)
        for index in range(samples):
            comment = Comment(
                comment_id=f"{fresh.id}:live:{index}", run_id=fresh.id,
                created_at=datetime.now(UTC), content=pool[index % len(pool)],
            )
            await repository.ingest_comment(comment)
            await repository.ingest_comment(comment)
        assert await repository.enqueue_batches() == 0
        async with repository.pool.connection() as conn:
            cursor = await conn.execute(
                "SELECT jsonb_array_length(members) AS size FROM commerce.analysis_batches "
                "WHERE run_id=%s ORDER BY created_at", (fresh.id,),
            )
            batch_sizes = [row["size"] for row in await cursor.fetchall()]
        assert batch_sizes == [10, 10], batch_sizes
        deadline = asyncio.get_running_loop().time() + 240
        while asyncio.get_running_loop().time() < deadline:
            await repository.reconcile()
            snapshot = await repository.snapshot(300)
            if snapshot.pipeline_error:
                raise RuntimeError(f"Pipeline failed: {snapshot.pipeline_error}")
            if snapshot.analysis.failed:
                raise RuntimeError(f"Output validation failed: {snapshot.comments}")
            if snapshot.analysis.classified + snapshot.analysis.unknown == samples:
                break
            await asyncio.sleep(2)
        else:
            raise TimeoutError("Actual pipeline did not classify the samples within 240 seconds")
        durations = sorted(
            (comment.analyzed_at - comment.created_at).total_seconds()
            for comment in snapshot.comments if comment.analyzed_at
        )
        assert len(durations) == samples
        assert snapshot.analysis.total == samples
        await repository.generate_briefing()
        snapshot = await repository.snapshot(300)
        if snapshot.briefing is None or snapshot.briefing.status != "completed":
            raise RuntimeError(f"Actual briefing failed: {snapshot.briefing}")
        return {
            "order_idempotency": True, "out_of_order_cancellation": True,
            "sql_totals_and_buckets": True, "reset_isolation": True,
            "real_model_samples": samples, "classification_p95_seconds": durations[ceil(.95*samples)-1],
            "batch_sizes": batch_sizes, "logical_classification_requests": len(batch_sizes),
            "partial_batch_collection_seconds": float(partial_batch["collection_seconds"]),
            "concurrent_flush_creates_one_job": True,
            "tick_lock_allows_batch_foreign_key": True,
            "analysis": snapshot.analysis.model_dump(),
            "briefing": snapshot.briefing.model_dump(mode="json"),
        }
    finally:
        if test_runs or preserved_run:
            async with repository.pool.connection() as conn:
                await conn.execute(
                    "UPDATE commerce.runs SET active=false,status='paused' WHERE id=ANY(%s)",
                    (test_runs,),
                )
                if preserved_run:
                    await conn.execute(
                        "UPDATE commerce.runs SET active=true WHERE id=%s", (preserved_run,),
                    )
        await repository.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Live commerce micro-batch integration check")
    parser.add_argument("--isolate-paused-run", action="store_true")
    parser.add_argument("--timeline-only", action="store_true")
    args = parser.parse_args()
    operation = check_timeline(Settings()) if args.timeline_only else check(
        Settings(), isolate_paused_run=args.isolate_paused_run,
    )
    print(json.dumps(asyncio.run(operation), ensure_ascii=False, indent=2))

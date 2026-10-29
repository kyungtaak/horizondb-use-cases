import json
import logging
from typing import Any
from uuid import UUID, uuid4

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from app.commerce.models import BATCH_MAX_COMMENTS, BatchMember, batch_ready, validate_batch

logger = logging.getLogger(__name__)
PIPELINE = "commerce_comment_classifier_v3"
LEGACY_PIPELINES = ("commerce_comment_classifier_v1", "commerce_comment_classifier_v2")
SINK_ACTION = "DO NOTHING"

Connection = AsyncConnection[dict[str, Any]]


async def enqueue_ready(conn: Connection, run_id: UUID) -> int:
    await conn.execute("SELECT pg_advisory_xact_lock(72421904)")
    count = 0
    while True:
        cursor = await conn.execute(
            "SELECT c.comment_id,c.content,c.updated_at AS source_version,"
            "clock_timestamp() AS checked_at FROM commerce.comments c "
            "JOIN commerce.runs r ON r.id=c.run_id AND r.active "
            "LEFT JOIN commerce.labels l ON l.comment_id=c.comment_id "
            "AND l.source_version=c.updated_at "
            "WHERE c.run_id=%s AND c.analysis_batch_id IS NULL AND l.comment_id IS NULL "
            "ORDER BY c.updated_at,c.comment_id LIMIT %s FOR UPDATE OF c SKIP LOCKED",
            (run_id, BATCH_MAX_COMMENTS),
        )
        rows = await cursor.fetchall()
        if not rows or not batch_ready(len(rows), rows[0]["source_version"], rows[0]["checked_at"]):
            return count
        members = [
            BatchMember.model_validate({key: row[key] for key in BatchMember.model_fields})
            for row in rows
        ]
        batch_id = uuid4()
        content = json.dumps({
            "comments": [
                {"comment_id": member.comment_id, "content": member.content} for member in members
            ],
        }, ensure_ascii=False)
        await conn.execute(
            "INSERT INTO commerce.analysis_batches(batch_id,run_id,content,members) "
            "VALUES(%s,%s,%s,%s)",
            (batch_id, run_id, content, Jsonb([member.model_dump(mode="json") for member in members])),
        )
        await conn.execute(
            "UPDATE commerce.comments SET analysis_batch_id=%s WHERE comment_id=ANY(%s)",
            (batch_id, [member.comment_id for member in members]),
        )
        count += 1


async def reconcile_batches(conn: Connection, model_alias: str) -> None:
    cursor = await conn.execute(
        "SELECT raw.* FROM commerce.batch_results raw "
        "JOIN commerce.runs r ON r.id=raw.run_id AND r.active "
        "WHERE EXISTS (SELECT 1 FROM commerce.comments c "
        "LEFT JOIN commerce.labels l ON l.comment_id=c.comment_id "
        "AND l.source_version=c.updated_at "
        "WHERE c.analysis_batch_id=raw.batch_id AND c.run_id=raw.run_id "
        "AND l.comment_id IS NULL) ORDER BY raw.created_at LIMIT 100"
    )
    for row in await cursor.fetchall():
        members = [BatchMember.model_validate(member) for member in row["members"]]
        labels, error = {}, None
        try:
            labels = validate_batch(row["generated_text"] or "", members)
        except ValueError as exc:
            error = f"묶음 분류 출력 검증 실패: {str(exc)[:300]}"
            logger.warning("Invalid commerce batch %s: %s", row["batch_id"], error)
        for member in members:
            label = labels.get(member.comment_id)
            await conn.execute(
                "INSERT INTO commerce.labels"
                "(comment_id,run_id,classification,error,model_alias,source_version,rule_version) "
                "SELECT c.comment_id,c.run_id,%s,%s,%s,%s,'v3-microbatch' "
                "FROM commerce.comments c JOIN commerce.runs r ON r.id=c.run_id AND r.active "
                "WHERE c.comment_id=%s AND c.run_id=%s AND c.analysis_batch_id=%s "
                "AND c.updated_at=%s "
                "ON CONFLICT(comment_id) DO UPDATE SET "
                "classification=EXCLUDED.classification,error=EXCLUDED.error,"
                "analyzed_at=now(),source_version=EXCLUDED.source_version,"
                "model_alias=EXCLUDED.model_alias,rule_version=EXCLUDED.rule_version "
                "WHERE EXCLUDED.source_version>=labels.source_version",
                (Jsonb(label.model_dump()) if label else None, error, model_alias,
                 member.source_version, member.comment_id, row["run_id"], row["batch_id"],
                 member.source_version),
            )

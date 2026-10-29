from datetime import UTC, datetime
from math import floor


def validate_timeline(timeline_seconds: int, bucket_seconds: int) -> None:
    if (timeline_seconds, bucket_seconds) not in ((300, 10), (900, 60)):
        raise ValueError("Timeline must be 300 seconds / 10 seconds or 900 seconds / 60 seconds")


def timeline_start(as_of: datetime, timeline_seconds: int, bucket_seconds: int) -> datetime:
    validate_timeline(timeline_seconds, bucket_seconds)
    last_start = floor(as_of.timestamp() / bucket_seconds) * bucket_seconds
    return datetime.fromtimestamp(last_start - timeline_seconds + bucket_seconds, UTC)


TIMELINE_SQL = """
WITH bounds AS (
    SELECT %(start)s::timestamptz AS start_at, %(as_of)s::timestamptz AS as_of,
           %(bucket)s * interval '1 second' AS step
), buckets AS (
    SELECT generate_series(start_at, as_of, step) AS minute FROM bounds
), orders AS (
    SELECT date_bin(b.step, o.paid_at, '1970-01-01'::timestamptz) AS minute,
           count(*) AS orders
    FROM commerce.orders o CROSS JOIN bounds b
    WHERE o.run_id=%(run)s AND o.paid_at>=b.start_at AND o.paid_at<b.as_of
    GROUP BY 1
), reactions AS (
    SELECT date_bin(b.step, c.created_at, '1970-01-01'::timestamptz) AS minute,
           count(*) AS comments,
           count(*) FILTER(WHERE l.classification->>'sentiment'='negative') AS negative,
           count(*) FILTER(WHERE l.classification->>'sentiment'
               IN ('positive','neutral','negative')) AS classified,
           count(*) FILTER(WHERE l.comment_id IS NULL) AS pending,
           count(*) FILTER(WHERE l.error IS NOT NULL) AS failed,
           count(*) FILTER(WHERE l.classification->>'sentiment'='unknown') AS unknown
    FROM commerce.comments c CROSS JOIN bounds b
    LEFT JOIN commerce.labels l ON l.comment_id=c.comment_id AND l.source_version=c.updated_at
    WHERE c.run_id=%(run)s AND c.created_at>=b.start_at AND c.created_at<b.as_of
    GROUP BY 1
)
SELECT b.minute,coalesce(o.orders,0) AS orders,
       coalesce(r.comments,0) AS comments,coalesce(r.negative,0) AS negative,
       coalesce(r.classified,0) AS classified,coalesce(r.pending,0) AS pending,
       coalesce(r.failed,0) AS failed,coalesce(r.unknown,0) AS unknown
FROM buckets b LEFT JOIN orders o USING(minute) LEFT JOIN reactions r USING(minute)
ORDER BY b.minute
"""

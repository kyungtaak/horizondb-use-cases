CREATE SCHEMA IF NOT EXISTS commerce;

CREATE TABLE IF NOT EXISTS commerce.runs (
    id UUID PRIMARY KEY,
    active BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL CHECK (status IN ('running', 'paused')),
    scene TEXT NOT NULL CHECK (scene IN ('normal', 'shipping', 'recovery')),
    seed INTEGER NOT NULL DEFAULT 42,
    sequence BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS commerce_one_active_run
    ON commerce.runs (active) WHERE active;

CREATE TABLE IF NOT EXISTS commerce.order_events (
    run_id UUID NOT NULL REFERENCES commerce.runs(id),
    event_id TEXT NOT NULL,
    order_id BIGINT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('received', 'paid', 'cancelled')),
    occurred_at TIMESTAMPTZ NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('app', 'phone', 'web')),
    amount BIGINT NOT NULL CHECK (amount = 99000),
    PRIMARY KEY (run_id, event_id)
);
CREATE INDEX IF NOT EXISTS commerce_event_order
    ON commerce.order_events (run_id, order_id);
CREATE TABLE IF NOT EXISTS commerce.orders (
    run_id UUID NOT NULL REFERENCES commerce.runs(id),
    order_id BIGINT NOT NULL,
    received_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    amount BIGINT NOT NULL CHECK (amount = 99000),
    channel TEXT NOT NULL,
    PRIMARY KEY (run_id, order_id)
);
CREATE INDEX IF NOT EXISTS commerce_paid_time ON commerce.orders (run_id, paid_at);

CREATE TABLE IF NOT EXISTS commerce.comments (
    comment_id TEXT PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES commerce.runs(id),
    created_at TIMESTAMPTZ NOT NULL,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commerce_comment_time ON commerce.comments (run_id, created_at);

-- ai.generate writes generated_text; retain source identity without chunking.
CREATE TABLE IF NOT EXISTS commerce.analysis_raw (
    comment_id TEXT PRIMARY KEY,
    run_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    generated_text TEXT
);
CREATE TABLE IF NOT EXISTS commerce.labels (
    comment_id TEXT PRIMARY KEY REFERENCES commerce.comments(comment_id),
    run_id UUID NOT NULL REFERENCES commerce.runs(id),
    classification JSONB,
    error TEXT,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    model_alias TEXT NOT NULL,
    rule_version TEXT NOT NULL DEFAULT 'v1',
    source_version TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS commerce.markers (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES commerce.runs(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS commerce.briefings (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES commerce.runs(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_as_of TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    result JSONB,
    error TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS commerce_one_pending_briefing
    ON commerce.briefings (run_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS commerce.analysis_batches (
    batch_id UUID PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES commerce.runs(id),
    content TEXT NOT NULL,
    members JSONB NOT NULL CHECK (
        jsonb_typeof(members) = 'array' AND jsonb_array_length(members) BETWEEN 1 AND 10
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS commerce_batch_run ON commerce.analysis_batches (run_id, created_at);
CREATE TABLE IF NOT EXISTS commerce.batch_results (
    batch_id UUID PRIMARY KEY,
    run_id UUID NOT NULL,
    content TEXT NOT NULL,
    members JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    generated_text TEXT
);
ALTER TABLE commerce.comments ADD COLUMN IF NOT EXISTS analysis_batch_id UUID;
CREATE INDEX IF NOT EXISTS commerce_unassigned_comments
    ON commerce.comments (run_id, updated_at) WHERE analysis_batch_id IS NULL;

ALTER TABLE commerce.markers ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'notice'
    CHECK (kind IN ('scene','notice'));
ALTER TABLE commerce.markers ADD COLUMN IF NOT EXISTS scene TEXT
    CHECK (scene IN ('normal','shipping','recovery'));

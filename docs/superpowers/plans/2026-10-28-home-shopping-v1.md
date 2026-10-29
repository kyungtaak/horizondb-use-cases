# Home Shopping V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working TV home-shopping demo beside Fleet, with server-side synthetic events, SQL aggregates, HorizonDB AI classification and evidence-based briefings.

**Architecture:** Control APIs operate a DB-backed shared simulation; synthetic events enter the same validated ingestion functions as future external producers. A separate HorizonDB `on_change` pipeline classifies comments with a configurable model alias; validated labels feed SQL aggregates. React polls every two seconds and preserves Fleet independently.

**Tech Stack:** Existing React/TypeScript/Vite, FastAPI/Pydantic, Psycopg 3, HorizonDB `azure_ai` and `pg_durable`. No new production dependencies.

**Spec:** [TV home-shopping design](../specs/2026-10-28-tv-home-shopping-design.md), supplemented by the conversation: control through API, internal backend ingestion, lightweight classifier and DB AI pipeline.

## Global Constraints

- Preserve unrelated dirty worktree changes and all Fleet behavior.
- One broadcast, one product, quantity one, price 99,000 KRW, target 200,000,000 KRW.
- Real AI results only; no canned success or neutral fallback on errors.
- Default response window 60 seconds; alternate 300 seconds; half-open intervals.
- Order generation and SQL aggregation must not wait for LLM calls.
- Classification and briefing model aliases are independent; never silently substitute an expensive model.
- No new Azure resources, model deployments or public deployment without confirmation.
- Python minimum 3.11; follow existing React styling and Korean copy.

## Review Focus

- Duplicate/out-of-order order events must preserve gross, cancellation and net totals: Task 1 tests.
- Old model responses after reset must never enter a new run: Tasks 1/2 tests.
- Invalid/missing model output must not look like classified neutral comments: Tasks 1/2 tests.
- Switching domains or losing the network must preserve state and expose stale data: Task 3/browser checks.
- Multiple backend processes must not generate the same shared run twice: Task 2 ownership checks.

## File boundaries

- Create `backend/app/commerce/models.py`: event, classification, control and snapshot contracts.
- Create `backend/app/commerce/repository.py`: DB pool, transactional ingestion, SQL aggregates and pipeline output validation.
- Create `backend/app/commerce/simulator.py`: deterministic event fixtures and single-owner runner, separately scheduled briefings.
- Create `backend/app/commerce/routes.py`: shopping control/read endpoints and lifecycle integration.
- Create `backend/app/commerce/setup.py` and `database/commerce.sql`: explicit idempotent schema/model/pipeline setup.
- Modify `backend/app/main.py` and `backend/app/config.py`: isolated opt-in lifecycle and configuration.
- Create focused `backend/tests/test_commerce*.py` tests.
- Create `frontend/src/commerce/` API/types/dashboard/styles; modify `App.tsx`/`App.css` for the domain selector.
- Create `docs/home-shopping.md`: setup, controls, model requirements, verification evidence and requirement matrix.

### Task 1: Persistent commerce ingestion and AI pipeline setup

**Interfaces**

- `OrderEvent`: run/event/order IDs, event type `received|paid|cancelled`, aware event time, channel, amount.
- `Classification`: sentiment `positive|neutral|negative|unknown`, allowed intent/topic arrays, evidence.
- `CommerceRepository(settings: Settings)`: `open()`, `close()`, `ingest_order(event)`, `ingest_comment(...)`, `snapshot(window_seconds, topic)`.
- Pipeline: `ai.generate(input => 'content', system_prompt => classification rules, model => classifier alias)`, no chunking; sink retains `comment_id`, `run_id`, timestamps and `generated_text`.

- [ ] Write failing tests for event idempotency, cancellation-before-payment projection, schema validation, malformed classifications and sentiment denominators.
- [ ] Run focused tests and confirm missing implementation failures.
- [ ] Implement typed contracts and schema: runs, immutable events, order projection, comments, raw pipeline sink, validated labels, markers and briefings.
- [ ] Use unique event IDs and order projection upserts within one transaction; preserve first payment after cancellation.
- [ ] Implement stable run-scoped SQL snapshots, zero-filled minute buckets, 20/40%/10 alert boundaries and topic evidence.
- [ ] Add explicit setup command registering configured model aliases and an incremental `on_change` pipeline with keyed sink.
- [ ] Run focused tests and SQL contract checks; document any live DB setup blocker explicitly.

### Task 2: Shared simulator, actual AI results and control APIs

**Interfaces**

- Controls under `/api/commerce`: `POST /control`, `GET /snapshot?window_seconds=60|300&topic=...`, `POST /briefing`, `POST /retry-analysis`.
- Control action `start|pause|reset|scene|notice`; scene `normal|shipping|recovery`; notice records verified demo guidance before recovery.
- `CommerceSimulator(repository)`: `start()`, `close()`; owns one dedicated advisory-lock connection, tracks event sequence in DB and releases ownership on shutdown.
- `mount_commerce(app, settings)` installs isolated lifecycle/router behavior; unavailable shopping returns an explicit 503 without breaking Fleet.

- [ ] Test deterministic scene-dependent generation, repeated start, pause, reset isolation, ownership contention and actual error responses with injected test fakes.
- [ ] Implement backend-internal ingestion at about 40/20/45 orders per minute and 30 comments per minute; seed and IDs remain replayable.
- [ ] Reconcile pipeline output through strict Pydantic validation and persist failures; expose pipeline history and pending age.
- [ ] Run briefing separately from order emission, at 30-second intervals or manual request; validate structured output and evidence IDs, preserve stale status on failure.
- [ ] Handle restart as paused, never automatically resume a previously running DB session; use bounded timeouts and explicit retries.
- [ ] Wire routes/lifespan; unit/API tests inject fakes, production uses the actual DB and model aliases.
- [ ] Run existing API tests alongside focused commerce tests.

### Task 3: Header selector and live dashboard

**Interfaces**

- `CommerceDashboard` polls the typed snapshot API without overlapping requests; receives whether shopping is active.
- Fleet component state remains mounted across domain changes; shopping state is likewise preserved after first visit.
- Native `<select aria-label="도메인 선택">` in the upper-right header, default Fleet.

- [ ] Implement selector with domain-specific header/navigation and hidden inactive content, preserving existing Fleet state.
- [ ] Implement product/run header, controls, four KPI cards, gross/net/cancellation details, shared-time trend charts and response marker.
- [ ] Add sentiment denominators/states, clickable topic cloud, original classified comments and briefing evidence.
- [ ] Show empty states, loading, failures, last successful refresh, pending age and old briefing timestamps; reset requires confirmation.
- [ ] Add responsive layouts and keyboard-accessible controls using existing project tokens, without new chart dependencies.
- [ ] Run TypeScript build/lint and browser checks for controls, domain round-trip, narrow viewport and network errors.

### Task 4: Verification and requirement report

- [ ] Run backend commerce and existing API tests, backend lint and frontend build/lint.
- [ ] When configured, run schema setup and a live ingestion → pipeline → validated classification → aggregate → briefing check with synthetic data only.
- [ ] Measure order display delay and comment classification p95 on at least 20 real-model samples; do not claim latency targets from mocked tests.
- [ ] Create a requirement matrix for AC-01 through AC-14: verified, implemented but unverified, blocked or deferred, with commands/evidence.
- [ ] Document configuration and repeatable demo steps; clearly identify cloud model/deployment requirements.
- [ ] Perform one independent code review, address concrete findings, and rerun affected checks.

## Execution and approval

Native execution in this session is recommended: backend contracts and the dashboard are tightly coupled, and one implementation context avoids interface drift. A fresh reviewer checks the final change. The user must confirm the plan/execution approach before implementation.

The user approved native execution and subsequently approved deployment to the existing Azure demo. Implementation and live mini-model integration are deployed; see [verification and requirement status](../../home-shopping.md) for completed checks, measurements and remaining work. No account policy or disableLocalAuth setting was changed.

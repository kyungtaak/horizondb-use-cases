# Commerce Scenario and Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three demo scenes discoverable and make genuine order/customer timeline data readable without confusing absent, pending and zero-negative observations.

**Architecture:** Keep simulation and real micro-batch classification unchanged. Extend SQL timeline buckets and persistent scene markers; render two aligned charts with axes, point markers, processing states and the actual scene-transition times. Move recovery controls into the same upper scenario area as scenes 1 and 2.

**Tech Stack:** Existing React/TypeScript, CSS, FastAPI/Pydantic, Psycopg and HorizonDB. Native Node tests for pure timeline geometry; no new dependencies.

**Spec:** [Approved home-shopping design](../specs/2026-10-28-tv-home-shopping-design.md) and the user's approval of the 2026-10-28 timeline diagnosis/recommendation.

## Global Constraints

- Preserve existing run, orders, comments, labels and the five-second/ten-comment real AI pipeline.
- Do not infer or fabricate old scene-change times: only existing notices and newly recorded transitions are markers.
- Default UI: latest 5 minutes, 10-second buckets; alternate: latest 15 minutes, 60-second buckets.
- Keep snapshot API defaults at the old 15-minute/60-second combination for existing callers; the new UI requests its selected timeline explicitly.
- Keep the legacy `minute` timestamp field as the bucket-start value for compatibility, including seconds in ten-second mode.
- Rolling last-60-second KPIs and fixed chart buckets remain distinct and are explicitly labeled.
- No charts show a missing reaction observation as 0%; genuine 0% remains visible, including a single isolated point.
- Only markers in the selected plotted interval appear on the chart; historic notices outside it are not appended as if current.
- Existing Native execution and deployment to the same Azure demo are retained; no new resources/policies/models.

## Review Focus

- Boundary events at a bucket edge must belong to exactly one half-open bucket: Task 1 SQL/live tests.
- No comments, all-pending, failed/unknown-only and genuine zero-negative states must differ: Tasks 1/2 tests.
- A lone valid point or separated valid segments must remain visible: Task 2 geometry and browser tests.
- Timeline filter request failures must retain the successful window's labels/data: Task 2 fixture check.
- Scene controls must record actual transitions without resetting orders or assuming start means scene 1: Task 1 control tests and Task 2 UI checks.

## File boundaries

- Modify `database/commerce.sql`: additive marker kind/scene metadata.
- Modify `backend/app/commerce/models.py`, `repository.py`, `routes.py`: bucket metadata, state counts, validated timeline selections and actual transition recording.
- Modify `backend/tests/test_commerce_api.py`; add `backend/tests/test_commerce_timeline.py`.
- Create `frontend/src/commerce/timeline.ts`, `timeline.test.mjs`, `TimelineChart.tsx`: pure geometry/state rules and accessible SVG charts.
- Modify `frontend/src/commerce/{CommerceDashboard.tsx,commerce.css,api.ts,types.ts}`: upper scenario controls, selectors and shared axes.
- Modify `backend/tests/commerce_browser_fixture.py`: explicit empty/pending/isolated/normal cases.
- Update `docs/home-shopping.md` and the Node test command in `frontend/package.json`.

### Task 1: Bucket and marker contracts

**Interfaces**

- `snapshot(window_seconds=60, topic=None, timeline_seconds=900, bucket_seconds=60)` keeps existing first two arguments.
- API allows only `(timeline_seconds,bucket_seconds)=(300,10)` or `(900,60)` and returns 422 for other combinations.
- Snapshot carries `timeline_seconds`, `bucket_seconds`; each trend row keeps `minute`, `orders`, `negative`, `classified` and adds `comments`, `pending`, `failed`, `unknown`.
- Marker adds `kind: scene|notice` and `scene: normal|shipping|recovery|null`; old notices remain valid.

- [ ] Write failing tests for valid/invalid timeline combinations and defaults; test distinct reaction states and interval boundaries.
- [ ] Add marker metadata columns without deleting old notes. Record new-run normal selection, changed normal/shipping scenes, and recovery notice with the corresponding scene.
- [ ] Group orders/comments once each into bounded, zero-filled SQL buckets with one shared `as_of`; preserve correct denominators and pending/version filtering.
- [ ] Filter returned markers to `[first_bucket_start, as_of)` and keep full notice text only for those markers.
- [ ] Test that repeated same-scene selection does not append duplicate transition events and starting a paused recovery run does not change it to normal.
- [ ] Run focused tests, then the backend regression suite.

### Task 2: Explicit scenario flow and aligned charts

**Interfaces**

- Upper execution controls remain start/pause/reset; scenario buttons become `01 판매 순항`, `02 배송 문의 급증`, `03 안내 보강·회복`.
- Recovery text input moves directly below this upper step row; its button records the input and enters recovery.
- `TimelineChart` consumes typed buckets, actual marker timestamps and the shared snapshot interval; it draws a circle for every valid value, even zero or a lone value.
- Pure helpers distinguish `empty`, `pending`, `unavailable`, `ready`; percentage is null unless the classified denominator is positive.

- [ ] Write native Node tests for zero vs null, an isolated point, null-separated segments, shared time coordinates and out-of-range markers.
- [ ] Implement charts with numeric y-axis labels, aligned timestamp x-axes, readable units and actual marker lines/labels; indicate the incomplete current bucket.
- [ ] Add an explicit legend for no-comment/pending/unavailable regions and per-point tooltip counts. Do not join lines across missing observations.
- [ ] Add the two timeline range options and clearly label the independent rolling customer/KPI windows.
- [ ] Move recovery out of the lower card; explain that start resumes the existing scene and scene changes affect only future events.
- [ ] Preserve successful timeline selection on request failure, like the existing topic/window behavior.
- [ ] Run `npm run test:commerce`, `npm run build`, `npm run lint`.
- [ ] Check the three controls, single/empty/pending fixtures, marker placement, axis labels and 390/1024/1440px layouts in the browser.

### Task 3: Live verification and rollout

- [ ] Perform one independent code review and address concrete findings with targeted tests.
- [ ] Pause/check the existing demo before applying additive schema changes; do not reset user data.
- [ ] Deploy the backend/frontend to existing Container Apps and verify both timeline modes through public APIs.
- [ ] Check actual bucket totals against existing order/comment data, boundary behavior and exclusion of out-of-range old notices.
- [ ] Exercise the three scene controls with a short real-model run, confirm recorded timestamps and preservation of cumulative orders, then leave the simulator paused.
- [ ] Update the report with verified behavior and remaining measurement/LLM-quality limitations; stop local check helpers.

## Approval

The user approved this plan and Native execution. Implementation and rollout are complete: 196 backend tests, four native Node chart tests, frontend build/lint, browser state/layout checks and live SQL/scene-transition checks passed. Existing data was preserved and the shared simulator was paused afterward. See [the verification report](../../home-shopping.md).

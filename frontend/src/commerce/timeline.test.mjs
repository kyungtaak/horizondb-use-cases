import assert from 'node:assert/strict'
import test from 'node:test'
import { lineGeometry, markerX, negativePercent, reactionState } from './timeline.ts'

const point = { comments: 0, pending: 0, failed: 0, unknown: 0, classified: 0, negative: 0 }

test('missing, pending, unavailable and real zero differ', () => {
  assert.equal(reactionState(point), 'empty')
  assert.equal(negativePercent(point), null)
  assert.equal(reactionState({ ...point, comments: 2, pending: 2 }), 'pending')
  assert.equal(reactionState({ ...point, comments: 1, failed: 1 }), 'unavailable')
  assert.equal(reactionState({ ...point, comments: 1, unknown: 1 }), 'unavailable')
  assert.equal(reactionState({ ...point, comments: 3, classified: 3 }), 'ready')
  assert.equal(negativePercent({ ...point, classified: 3 }), 0)
})

test('one valid zero point remains visible', () => {
  const geometry = lineGeometry([null, 0, null], 100)
  assert.equal(geometry.points.length, 1)
  assert.deepEqual(geometry.points[0], { index: 1, x: 50, y: 100, value: 0 })
  assert.equal(geometry.path.match(/M/g).length, 1)
})

test('missing buckets split line segments', () => {
  const geometry = lineGeometry([10, null, 50, 0], 100)
  assert.equal(geometry.path.match(/M/g).length, 2)
  assert.equal(geometry.path.match(/L/g).length, 1)
  assert.equal(geometry.points.length, 3)
})

test('markers use the same time domain as bucket centers', () => {
  const start = Date.parse('2026-10-28T11:00:00Z')
  const end = start + 30000
  assert.equal(markerX(new Date(start + 15000).toISOString(), start, end), 50)
  assert.equal(lineGeometry([0, 0, 0], 100).points[1].x, 50)
  assert.equal(markerX(new Date(start - 1).toISOString(), start, end), null)
  assert.equal(markerX(new Date(end).toISOString(), start, end), null)
})

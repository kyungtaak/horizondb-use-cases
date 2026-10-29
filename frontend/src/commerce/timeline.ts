import type { Marker, Trend } from './types'

export type TimelineMode = 'short' | 'long'
export const timelineModes = {
  short: { seconds: 300, bucket: 10, label: '최근 5분 · 10초 단위' },
  long: { seconds: 900, bucket: 60, label: '최근 15분 · 1분 단위' },
} as const

type ReactionCounts = Pick<Trend, 'comments' | 'classified' | 'negative' | 'pending' | 'failed' | 'unknown'>

export function negativePercent(point: ReactionCounts): number | null {
  return point.classified > 0 ? point.negative / point.classified * 100 : null
}

export function reactionState(point: ReactionCounts): 'ready' | 'empty' | 'pending' | 'unavailable' {
  if (point.classified > 0) return 'ready'
  if (point.pending > 0) return 'pending'
  return point.comments > 0 ? 'unavailable' : 'empty'
}

export function lineGeometry(values: (number | null)[], ceiling: number) {
  const points: { index: number; x: number; y: number; value: number }[] = []
  const path = values.map((value, index) => {
    if (value === null) return ''
    const x = (index + 0.5) / values.length * 100
    const y = 100 - value / ceiling * 100
    points.push({ index, x, y, value })
    return `${index === 0 || values[index - 1] === null ? 'M' : 'L'}${x.toFixed(3)},${y.toFixed(3)}`
  }).join(' ')
  return { path, points }
}

export function markerX(at: string, start: number, end: number): number | null {
  const timestamp = Date.parse(at)
  return timestamp >= start && timestamp < end ? (timestamp - start) / (end - start) * 100 : null
}

export function markerLabel(marker: Marker): string {
  if (marker.kind === 'notice' || marker.scene === 'recovery') return '03 안내 보강·회복'
  return marker.scene === 'shipping' ? '02 배송 문의 급증' : '01 판매 순항'
}

export const timelineTime = (at: string | number) => new Date(at).toLocaleTimeString('ko-KR', {
  timeZone: 'Asia/Seoul', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
})

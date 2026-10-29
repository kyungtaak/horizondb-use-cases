import { lineGeometry, markerLabel, markerX, negativePercent, reactionState, timelineTime } from './timeline'
import type { Marker, Trend } from './types'

export function TimelineChart({ points, markers, bucketSeconds, metric }: {
  points: Trend[]
  markers: Marker[]
  bucketSeconds: number
  metric: 'orders' | 'negative'
}) {
  if (!points.length) return <p className="commerce-fine">데모를 시작하면 시간대별 집계를 표시합니다.</p>
  const orders = metric === 'orders'
  const unit = bucketSeconds === 60 ? '1분' : `${bucketSeconds}초`
  const label = orders ? `결제 완료 주문 · 건 / ${unit}` : '분석 완료 댓글의 부정 비율 · %'
  const values = points.map(point => orders ? point.orders : negativePercent(point))
  const maximum = Math.max(0, ...points.map(point => point.orders))
  const ceiling = orders ? maximum <= 4 ? 4 : Math.ceil(maximum / 10) * 10 : 100
  const geometry = lineGeometry(values, ceiling)
  const start = Date.parse(points[0].minute)
  const end = Date.parse(points[points.length - 1].minute) + bucketSeconds * 1000
  const visibleMarkers = markers.flatMap(marker => {
    const x = markerX(marker.created_at, start, end)
    return x === null ? [] : [{ marker, x }]
  })

  function pointDescription(index: number, value: number) {
    const point = points[index]
    const endTime = Date.parse(point.minute) + bucketSeconds * 1000
    const period = `${timelineTime(point.minute)}–${timelineTime(endTime)}`
    const current = index === points.length - 1 ? ' · 현재 구간 집계 중' : ''
    return orders
      ? `${period} · 결제 ${value}건${current}`
      : `${period} · 부정 ${value.toFixed(1)}% (${point.negative}/${point.classified}건)`
        + ` · 분석 대기 ${point.pending} · 실패 ${point.failed} · 판정 불가 ${point.unknown}${current}`
  }

  return <section className={`commerce-timeline-chart ${metric}`} aria-label={label}>
    <div className="commerce-chart-heading"><strong>{label}</strong><small>마지막 구간 집계 중</small></div>
    <div className="commerce-chart-frame">
      <div className="commerce-y-axis" aria-hidden="true">
        <span>{ceiling}{orders ? '' : '%'}</span><span>{ceiling / 2}{orders ? '' : '%'}</span><span>0{orders ? '' : '%'}</span>
      </div>
      <div className="commerce-plot">
        {!orders && points.map((point, index) => {
          const state = reactionState(point)
          return <span key={point.minute} className={`commerce-chart-region ${state}`} style={{
            left: `${index / points.length * 100}%`, width: `${100 / points.length}%`,
          }} title={`${timelineTime(point.minute)} · 댓글 ${point.comments} · 대기 ${point.pending} · 실패 ${point.failed} · 판정 불가 ${point.unknown}`} />
        })}
        <span className="commerce-chart-partial" style={{ left: `${(points.length - 1) / points.length * 100}%`, width: `${100 / points.length}%` }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="commerce-grid" d="M0 0H100 M0 50H100 M0 100H100" vectorEffect="non-scaling-stroke" />
          <path d={geometry.path} className="commerce-line" vectorEffect="non-scaling-stroke" />
        </svg>
        {geometry.points.map(point => <span key={point.index} className="commerce-chart-point"
          style={{ left: `${point.x}%`, top: `${point.y}%` }} role="img"
          aria-label={pointDescription(point.index, point.value)} title={pointDescription(point.index, point.value)} />)}
        {visibleMarkers.map(({ marker, x }, index) => <span className="commerce-chart-event"
          style={{ left: `${x}%` }} key={`${marker.created_at}:${index}`}
          role="img" aria-label={`${timelineTime(marker.created_at)} ${markerLabel(marker)} · ${marker.note}`}
          title={`${timelineTime(marker.created_at)} ${markerLabel(marker)} · ${marker.note}`}>
          <b style={{ top: `${index % 3 * 18}px` }}>{markerLabel(marker).slice(0, 2)}</b>
        </span>)}
      </div>
    </div>
    <div className="commerce-timeline-axis">
      <span>{timelineTime(start)}</span><span>{timelineTime((start + end) / 2)}</span><span>{timelineTime(end)}</span>
    </div>
  </section>
}

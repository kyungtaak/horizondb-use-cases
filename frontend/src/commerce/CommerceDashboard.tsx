import { useEffect, useState } from 'react'
import { Activity, CirclePause, Play, RotateCcw, Sparkles } from 'lucide-react'
import { controlCommerce, getCommerceSnapshot, refreshBriefing, retryCommerceAnalysis } from './api'
import type { Control, Snapshot } from './types'
import { TimelineChart } from './TimelineChart'
import { markerLabel, timelineModes } from './timeline'
import type { TimelineMode } from './timeline'
import './commerce.css'

const number = (value: number) => value.toLocaleString('ko-KR')
const time = (value: string) => new Date(value).toLocaleTimeString('ko-KR', {
  timeZone: 'Asia/Seoul', hour12: false,
})
const sentimentNames = { positive: '긍정', neutral: '중립', negative: '부정', unknown: '판정 불가' }
const sceneNames = { normal: '판매 순항', shipping: '배송 문의 급증', recovery: '안내 보강 이후' }
const channels: Record<string, string> = { app: '앱', phone: 'TV 전화', web: '웹' }
const RECOVERY_NOTICE = '결제 후 영업일 기준 2일 이내 출고, 도착일은 지역별로 다름'

export function CommerceDashboard({ active }: { active: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [windowSeconds, setWindowSeconds] = useState(60)
  const [topic, setTopic] = useState<string | null>(null)
  const [appliedTopic, setAppliedTopic] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineMode>('short')
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      try {
        const next = await getCommerceSnapshot(windowSeconds, topic, controller.signal, timeline)
        if (!controller.signal.aborted) {
          setSnapshot(next)
          setAppliedTopic(topic)
          setError(null)
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '홈쇼핑 조회 실패')
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 2000)
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [active, windowSeconds, topic, revision, timeline])

  async function act(command: Control | 'briefing' | 'retry') {
    if (typeof command !== 'string' && command.action === 'reset'
      && !window.confirm('현재 실행을 종료하고 새 데모를 준비할까요? 이전 실행의 데이터는 보존됩니다.')) return
    setBusy(true)
    setActionError(null)
    try {
      if (command === 'briefing') await refreshBriefing()
      else if (command === 'retry') await retryCommerceAnalysis()
      else await controlCommerce(command)
      setRevision(value => value + 1)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '데모 조작 실패')
    } finally { setBusy(false) }
  }

  const metrics = snapshot?.metrics
  const analysis = snapshot?.analysis
  const hasAnalysis = (analysis?.classified ?? 0) > 0
  const percentage = (count: number) => analysis && hasAnalysis ? `${(count / analysis.classified * 100).toFixed(0)}%` : '—'
  const run = snapshot?.run
  const filtersPending = snapshot && (
    snapshot.window_seconds !== windowSeconds || appliedTopic !== topic
    || snapshot.timeline_seconds !== timelineModes[timeline].seconds
  )
  const appliedTimeline = snapshot?.timeline_seconds === 300 ? 'short' : 'long'

  return <main className="commerce-workspace" hidden={!active}>
    <div className="commerce-intro">
      <div><span className="commerce-eyebrow">TV HOME SHOPPING · SYNTHETIC LIVE DATA</span>
        <h1>라이브 커머스 관제실</h1><p>주문은 SQL로, 고객 반응은 실제 AI pipeline으로 분석합니다.</p></div>
      <span className="commerce-badge"><Activity size={14} />{run?.status === 'running' ? '시뮬레이터 실행 중' : '시뮬레이터 대기'}</span>
    </div>
    <div className="commerce-notice">가상 주문·댓글로 시연합니다. 고객 감정과 브리핑은 실제 모델 결과만 표시하며, 분석 지연·실패를 별도로 표시합니다.</div>
    {error && <div className="commerce-error" role="alert">{error}
      {snapshot && <span>표시 중인 값은 마지막 정상 조회 {time(snapshot.as_of)} 기준입니다.</span>}
      <button onClick={() => setRevision(value => value + 1)}>다시 연결</button>
    </div>}
    {actionError && <div className="commerce-error" role="alert">{actionError}</div>}
    {filtersPending && <div className="commerce-notice" role="status">
      {error ? '선택한 조건을 적용하지 못했습니다.' : '선택한 조건을 조회하고 있습니다.'}
      표시 중인 값은 최근 {snapshot.window_seconds / 60}분 · {appliedTopic ?? '전체 주제'} 기준입니다.
      차트는 {snapshot.timeline_seconds / 60}분 · {snapshot.bucket_seconds}초 단위입니다.
    </div>}
    {run?.error && <div className="commerce-notice" role="status">{run.error}</div>}
    <section className="commerce-card commerce-product">
      <div><span className="commerce-eyebrow">방송 B-001 · 상품 P-1042</span>
        <h2>에어쿡 듀얼 에어프라이어 6L</h2><p>판매가 99,000원 · 1주문 1개 · 목표 결제액 2억 원</p></div>
      <div className="commerce-controls">
        <span className="commerce-fine">실행 제어</span>
        <button disabled={busy || !snapshot || run?.status === 'running'} onClick={() => void act({ action: 'start' })}><Play size={14} />시작</button>
        <button disabled={busy || run?.status !== 'running'} onClick={() => void act({ action: 'pause' })}><CirclePause size={14} />일시정지</button>
        <button disabled={busy || !run} onClick={() => void act({ action: 'reset' })}><RotateCcw size={14} />초기화</button>
      </div>
    </section>
    <section className="commerce-card commerce-scenario" aria-label="데모 시나리오">
      <div className="commerce-section-head"><h2>방송 시나리오</h2><span className="commerce-badge">{run ? `현재: ${sceneNames[run.scene]}` : '시작 버튼으로 새 방송을 준비하세요.'}</span></div>
      <div className="commerce-scenes" aria-label="장면 선택">
        <button disabled={busy || !run} aria-pressed={run?.scene === 'normal'} onClick={() => void act({ action: 'scene', scene: 'normal' })}><strong>01 판매 순항</strong><small>판매와 일반 질문 관찰</small></button>
        <button disabled={busy || !run} aria-pressed={run?.scene === 'shipping'} onClick={() => void act({ action: 'scene', scene: 'shipping' })}><strong>02 배송 문의 급증</strong><small>배송 우려 상황 주입</small></button>
        <button disabled={busy || !run} aria-pressed={run?.scene === 'recovery'} onClick={() => void act({ action: 'notice', notice: RECOVERY_NOTICE })}><strong>03 안내 보강·회복</strong><small>배송·출고 안내 후 고객 반응 회복</small></button>
      </div>
      <p className="commerce-fine">시작은 현재 장면을 재개합니다. 처음부터 비교하려면 01을 선택하세요. 장면 변경은 이후 이벤트만 바꾸며 기존 댓글·주문을 지우지 않습니다. 실제 방송 자막이나 고객 메시지는 변경하지 않습니다.</p>
    </section>
    {!snapshot ? <p role="status">홈쇼핑 데이터를 연결하고 있습니다. 연결에 실패하면 위 오류를 확인하세요.</p> : <>
      <section className="commerce-kpis" aria-label="판매 KPI">
        <div className="commerce-card"><span>누적 결제 완료 주문</span><strong>{number(metrics!.paid)}<small>건</small></strong><p>접수 {number(metrics!.received)}건 · 현재 실행·방송·상품 기준</p></div>
        <div className="commerce-card"><span>누적 결제액 · 취소 차감 전</span><strong>{number(metrics!.gross)}<small>원</small></strong><p>취소 {number(metrics!.cancelled)}건 / {number(metrics!.cancelled_amount)}원</p></div>
        <div className="commerce-card"><span>결제액 목표 달성률</span><strong>{(metrics!.gross / metrics!.target * 100).toFixed(1)}<small>%</small></strong><p>취소 차감 전 결제액 / {number(metrics!.target)}원</p></div>
        <div className="commerce-card"><span>직전 60초 결제 완료 · 이동 집계</span><strong>{number(metrics!.last_minute)}<small>건</small></strong><p>순결제 {number(metrics!.net)}건 / {number(metrics!.net_amount)}원</p></div>
      </section>
      <div className="commerce-columns">
        <div className="commerce-stack">
          <section className="commerce-card">
            <div className="commerce-section-head"><h2>판매와 고객 반응의 동시 관찰</h2>
              <select aria-label="차트 조회 구간" value={appliedTimeline} onChange={event => setTimeline(event.target.value === 'short' ? 'short' : 'long')}>
                <option value="short">{timelineModes.short.label}</option><option value="long">{timelineModes.long.label}</option>
              </select>
            </div>
            <p className="commerce-fine">두 차트는 같은 시간축의 고정 구간 집계입니다. 우측 고객 분위기·상단 직전 60초 이동 집계와 구간이 다릅니다.</p>
            <TimelineChart points={snapshot.trend} markers={snapshot.markers} bucketSeconds={snapshot.bucket_seconds} metric="orders" />
            <TimelineChart points={snapshot.trend} markers={snapshot.markers} bucketSeconds={snapshot.bucket_seconds} metric="negative" />
            <div className="commerce-chart-legend"><span className="empty">댓글 없음</span><span className="pending">분석 대기</span><span className="unavailable">판정 불가·실패</span></div>
            <p className="commerce-fine">0% 점은 감정 판정이 가능한 댓글 중 부정이 0건이라는 뜻입니다. 해당 판정이 한 건도 없으면 선을 잇지 않습니다. 일부 분석이 대기 중이면 완료된 댓글로만 계산합니다. 점에 마우스를 올리면 구간별 건수가 표시됩니다.</p>
            <div className="commerce-visible-events" aria-label="차트 구간의 장면 기록">
              {snapshot.markers.map((marker, index) => <p className="commerce-marker" key={`${marker.created_at}:${index}`}><strong>{time(marker.created_at)} {markerLabel(marker)}</strong><br />{marker.note}</p>)}
              {!snapshot.markers.length && <p className="commerce-fine">선택한 구간의 장면 전환 기록이 없습니다.</p>}
            </div>
            <p className="commerce-fine">주문과 반응을 함께 관찰합니다. 설명 전후 변화만으로 매출 효과의 인과관계를 단정하지 않습니다.</p>
          </section>
          <section className="commerce-card commerce-briefing">
            <div className="commerce-section-head"><h2><Sparkles size={16} /> AI 운영 브리핑</h2>
              <button disabled={busy || !run || snapshot.briefing?.status === 'pending'} onClick={() => void act('briefing')}>지금 분석</button></div>
            {snapshot.briefing?.result ? <>
              <h3>{snapshot.briefing.result.summary}</h3>
              <p>{snapshot.briefing.result.suggestion}</p>
              <details><summary>근거 댓글 ID {snapshot.briefing.result.evidence_ids.length}건</summary>
                {snapshot.briefing.result.evidence_ids.map(id => <p key={id}>{snapshot.comments.find(comment => comment.comment_id === id)?.content ?? `생성 시점 댓글 ${id}`}</p>)}
              </details>
            </> : <p>{snapshot.briefing?.status === 'pending' ? '실제 모델로 브리핑을 생성하고 있습니다.' : '브리핑 결과가 없습니다. 시작 후 자동 생성되거나 지금 분석을 누르세요.'}</p>}
            {snapshot.briefing?.error && <p className="commerce-error" role="alert">{snapshot.briefing.error}</p>}
            {snapshot.briefing && <small>데이터 기준 {time(snapshot.briefing.data_as_of)} · 생성 {snapshot.briefing.completed_at ? time(snapshot.briefing.completed_at) : '대기 중'}</small>}
          </section>
          <section className="commerce-card">
            <div className="commerce-section-head"><h2>최근 주문</h2><small>{Object.entries(metrics!.channels).map(([channel, count]) => `${channels[channel]} ${count}건`).join(' · ') || '아직 주문이 없습니다.'}</small></div>
            <table><thead><tr><th>주문</th><th>채널</th><th>결제 시각</th><th>상태</th></tr></thead><tbody>
              {snapshot.recent_orders.map(order => <tr key={order.order_id}><td>O-{order.order_id}</td><td>{channels[order.channel] ?? order.channel}</td><td>{order.paid_at ? time(order.paid_at) : '—'}</td><td>{order.cancelled_at ? '결제 취소' : order.paid_at ? '결제 완료' : '접수'}</td></tr>)}
            </tbody></table>
          </section>
        </div>
        <div className="commerce-stack">
          <section className="commerce-card">
            <div className="commerce-section-head"><h2>실시간 고객 분위기</h2>
              <select aria-label="댓글 조회 구간" value={snapshot.window_seconds} onChange={event => setWindowSeconds(Number(event.target.value))}><option value={60}>최근 1분</option><option value={300}>최근 5분</option></select></div>
            <p className="commerce-fine">현재 시각에서 직전 {snapshot.window_seconds}초를 보는 이동 집계입니다. 차트의 고정 구간 비율과 다를 수 있습니다.</p>
            {analysis!.alert && <div className="commerce-error" role="alert">배송 관련 부정 반응이 늘었습니다. 최근 1분 분석 근거를 확인하세요.</div>}
            <div className="commerce-sentiments">
              {(['positive', 'neutral', 'negative'] as const).map(sentiment => <div key={sentiment} className={`commerce-${sentiment}`}><strong>{percentage(analysis![sentiment])}</strong><span>{sentimentNames[sentiment]} {analysis![sentiment]}건</span></div>)}
            </div>
            <p className="commerce-fine">전체 {analysis!.total}건 · 감정 비율 분모 {analysis!.classified}건<br />판정 불가 {analysis!.unknown} · 대기 {analysis!.pending} · 실패 {analysis!.failed}</p>
            <p className="commerce-fine">최장 대기 {Math.floor(analysis!.oldest_pending_seconds)}초 · 모델 {snapshot.model_alias}</p>
            <p className="commerce-fine">첫 대기 댓글 기준 5초 또는 10건 도달 시 묶음 분석 · 모델 처리 시간 별도</p>
            {snapshot.pipeline_error && <div className="commerce-error" role="alert">AI pipeline 오류: {snapshot.pipeline_error}</div>}
            {analysis!.classified < 20 && <p className="commerce-fine">최근 구간의 분석 표본이 적습니다. 경고는 최근 1분의 판정 가능 댓글 20건 이상부터 평가합니다.</p>}
            <button disabled={busy || !run} onClick={() => void act('retry')}>실패·60초 이상 대기 분석 재시도</button>
            <div className="commerce-cloud" aria-label="관심 주제">
              {snapshot.topics.map(item => <button key={item.topic} aria-pressed={appliedTopic === item.topic} style={{ fontSize: `${Math.min(28, 14 + item.count)}px` }} onClick={() => { setTopic(appliedTopic === item.topic ? null : item.topic); setRevision(value => value + 1) }}>{item.topic} <small>{item.count}</small></button>)}
              {!snapshot.topics.length && <p>분석 완료 후 관심 주제를 표시합니다.</p>}
            </div>
            <p className="commerce-fine">숫자는 주제를 언급한 고유 댓글 수입니다. 복수 주제 분류를 허용합니다.</p>
          </section>
          <section className="commerce-card">
            <div className="commerce-section-head"><h2>{appliedTopic ? `${appliedTopic} 관련 댓글` : '댓글과 분류 근거'}</h2>{appliedTopic && <button onClick={() => setTopic(null)}>전체 보기</button>}</div>
            <p className="commerce-fine">질문·불만·감상 등 의도는 감정과 별도로 분류합니다. 최대 최근 30건.</p>
            {!snapshot.comments.length && <p>조회 구간에 표시할 댓글이 없습니다.</p>}
            {snapshot.comments.map(comment => <article className="commerce-comment" key={comment.comment_id}>
              <small>가상 시청자 · {time(comment.created_at)}</small><p>{comment.content}</p>
              {comment.classification ? <>
                <div className="commerce-tags"><span className={`commerce-${comment.classification.sentiment}`}>{sentimentNames[comment.classification.sentiment]}</span>{[...new Set([...comment.classification.intents, ...comment.classification.topics])].map(tag => <span key={tag}>{tag}</span>)}</div>
                <small>근거: {comment.classification.evidence} · {comment.analyzed_at && time(comment.analyzed_at)}</small>
              </> : <small className={comment.status === 'failed' ? 'commerce-negative' : ''}>{comment.error ?? '실제 모델 분석 대기 중'}</small>}
            </article>)}
          </section>
        </div>
      </div>
      <footer className="commerce-footer">기준 시각 {time(snapshot.as_of)} · 2초 간격 조회 · 주문 집계는 LLM과 독립 · SQL 집계 / HorizonDB AI pipeline</footer>
    </>}
  </main>
}

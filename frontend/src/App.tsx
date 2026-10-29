import {
  startTransition,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Bot,
  Boxes,
  ChartNoAxesCombined,
  Database,
  LayoutGrid,
  Map as MapIcon,
  PackageSearch,
  Radio,
  Workflow,
} from 'lucide-react'
import {
  getCapabilities,
  getShipments,
  getShipmentStats,
  searchShipments,
  searchCriteria,
} from './api'
import { ChatPanel } from './components/ChatPanel'
import { DemoDataPanel } from './components/DemoDataPanel'
import { ShipmentDetail } from './components/ShipmentDetail'
import { ShipmentList } from './components/ShipmentList'
import { ShipmentMap } from './components/ShipmentMap'
import { UseCaseOverview } from './components/UseCaseOverview'
import { CommerceDashboard } from './commerce/CommerceDashboard'
import { USE_CASES } from './useCases'
import type { UseCaseId } from './useCases'
import type {
  DatabaseCapabilities,
  CriteriaSearchRequest,
  CriteriaSearchResponse,
  Coordinate,
  SearchResponse,
  SearchProgress,
  Shipment,
  ShipmentStats,
  ShipmentStatus,
} from './types'
import './App.css'

type MobileView = 'shipments' | 'map' | 'assistant'
type DemoView = 'overview' | UseCaseId

const DEFAULT_CRITERIA: CriteriaSearchRequest = {
  query: '', status: null, eta_date: null, eta_days: 3, search_center: null,
  radius_km: 500, ranking: 'semantic', limit: 24,
}

function App() {
  const [domain, setDomain] = useState<DemoView>('overview')
  const [fleetVisited, setFleetVisited] = useState(false)
  const [commerceVisited, setCommerceVisited] = useState(false)
  const caseNavigation = useRef<HTMLSelectElement | null>(null)
  const activeUseCase = USE_CASES.find(useCase => useCase.id === domain)
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [semanticResults, setSemanticResults] = useState<Shipment[] | null>(null)
  const [stats, setStats] = useState<ShipmentStats | null>(null)
  const [capabilities, setCapabilities] =
    useState<DatabaseCapabilities | null>(null)
  const [selected, setSelected] = useState<Shipment | null>(null)
  const [locateRequest, setLocateRequest] = useState(0)
  const [locating, setLocating] = useState(false)
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA)
  const [criteriaResult, setCriteriaResult] = useState<CriteriaSearchResponse | null>(null)
  const [appliedCriteria, setAppliedCriteria] = useState<CriteriaSearchRequest | null>(null)
  const [resultSource, setResultSource] = useState<'criteria' | 'agent' | null>(null)
  const [criteriaSearching, setCriteriaSearching] = useState(false)
  const [criteriaError, setCriteriaError] = useState<string | null>(null)
  const [pickingCenter, setPickingCenter] = useState(false)
  const criteriaAbort = useRef<AbortController | null>(null)
  const searchGeneration = useRef(0)
  const [mobileView, setMobileView] = useState<MobileView>('map')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)
  const [chatRevision, setChatRevision] = useState(0)
  const [queryRequest, setQueryRequest] = useState<{
    id: number
    query: string
  } | null>(null)
  useEffect(() => () => criteriaAbort.current?.abort(), [])

  useEffect(() => {
    document.title = activeUseCase
      ? `${activeUseCase.title} | HorizonDB Use Cases`
      : 'HorizonDB Use Cases'
  }, [activeUseCase])

  function navigate(next: DemoView) {
    setDomain(next)
    if (next === 'fleet') setFleetVisited(true)
    if (next === 'commerce') setCommerceVisited(true)
    caseNavigation.current?.focus()
  }

  function cancelCriteria() {
    criteriaAbort.current?.abort()
    criteriaAbort.current = null
    searchGeneration.current += 1
    setCriteriaSearching(false)
  }

  function resetCriteria() {
    cancelCriteria()
    setCriteria(DEFAULT_CRITERIA)
    setCriteriaResult(null)
    setAppliedCriteria(null)
    setResultSource(null)
    setCriteriaError(null)
    setPickingCenter(false)
  }

  async function runCriteriaSearch() {
    cancelCriteria()
    const controller = new AbortController()
    criteriaAbort.current = controller
    const generation = searchGeneration.current
    const request = { ...criteria, query: criteria.query.trim() }
    setCriteriaSearching(true)
    setCriteriaError(null)
    setPickingCenter(false)
    try {
      const result = await searchCriteria(request, controller.signal)
      if (controller.signal.aborted || generation !== searchGeneration.current) return
      startTransition(() => {
        setSemanticResults(result.shipments)
        setCriteriaResult(result)
        setAppliedCriteria(request)
        setCriteria(request)
        setResultSource('criteria')
        clearSelection()
      })
    } catch (searchError) {
      if (!controller.signal.aborted) setCriteriaError(searchError instanceof Error ? searchError.message : '검색하지 못했습니다.')
    } finally {
      if (criteriaAbort.current === controller) {
        criteriaAbort.current = null
        setCriteriaSearching(false)
      }
    }
  }

  function pickSearchCenter(point: Coordinate) {
    setCriteria(current => ({ ...current, search_center: point }))
    setPickingCenter(false)
    setMobileView('shipments')
  }

  async function loadWorkspace() {
    showAllShipments()
    setLoading(true)
    setError(null)
    try {
      const [nextShipments, nextStats, nextCapabilities] = await Promise.all([
        getShipments(),
        getShipmentStats(),
        getCapabilities(),
      ])
      startTransition(() => {
        setShipments(nextShipments)
        setStats(nextStats)
        setCapabilities(nextCapabilities)
      })
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the shipping workspace.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!fleetVisited) return
    let cancelled = false
    Promise.all([getShipments(), getShipmentStats(), getCapabilities()])
      .then(([nextShipments, nextStats, nextCapabilities]) => {
        if (cancelled) return
        startTransition(() => {
          setShipments(nextShipments)
          setStats(nextStats)
          setCapabilities(nextCapabilities)
        })
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the shipping workspace.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fleetVisited])

  const visibleShipments = semanticResults ?? shipments

  const selectionOutsideResults = selected !== null && !visibleShipments.some(
    (shipment) => shipment.shipment_number === selected.shipment_number,
  )

  function selectShipment(shipment: Shipment, revealMap = false) {
    setSelected(shipment)
    setLocating(false)
    if (revealMap) setMobileView('map')
  }

  function locateShipment(shipment: Shipment) {
    setSelected(shipment)
    setLocating(true)
    setLocateRequest((current) => current + 1)
    setMobileView('map')
  }

  function clearSelection() {
    setSelected(null)
    setLocating(false)
  }

  function showAllShipments() {
    resetCriteria()
    startTransition(() => {
      setSemanticResults(null)
      setSelected(null)
      setLocating(false)
    })
  }

  function applyDemoShipments(changed: Shipment[], focus: Shipment | null) {
    resetCriteria()
    startTransition(() => {
      setShipments((current) => {
        const merged = new Map(
          current.map((shipment) => [shipment.shipment_number, shipment]),
        )
        changed.forEach((shipment) => {
          merged.set(shipment.shipment_number, shipment)
        })
        return [...merged.values()].sort((left, right) =>
          left.shipment_number.localeCompare(right.shipment_number),
        )
      })
      setSemanticResults(null)
      setSelected(focus)
      setLocating(Boolean(focus))
      if (focus) setLocateRequest((current) => current + 1)
    })
    void Promise.all([getShipmentStats(), getCapabilities()]).then(
      ([nextStats, nextCapabilities]) => {
        startTransition(() => {
          setStats(nextStats)
          setCapabilities(nextCapabilities)
        })
      },
    )
  }

  function verifyDemoData(query: string) {
    setDemoOpen(false)
    setMobileView('assistant')
    setQueryRequest((current) => ({
      id: (current?.id ?? 0) + 1,
      query,
    }))
  }

  function removeDemoShipments(shipmentIds: string[]) {
    resetCriteria()
    const deleted = new Set(shipmentIds)
    const removed = shipments.filter((shipment) => deleted.has(shipment.id))
    setShipments((current) => current.filter((shipment) => !deleted.has(shipment.id)))
    setStats((current) => current ? {
      total: current.total - removed.length,
      statuses: current.statuses.map((item) => ({
        ...item,
        count: item.count - removed.filter((shipment) => shipment.status === item.status).length,
      })),
    } : null)
    setSemanticResults(null)
    setSelected(null)
    setLocating(false)
    setQueryRequest(null)
    setChatRevision((current) => current + 1)
  }

  async function runSemanticSearch(
    query: string, onProgress: (event: SearchProgress) => void, signal: AbortSignal,
  ): Promise<SearchResponse> {
    cancelCriteria()
    const generation = searchGeneration.current
    setPickingCenter(false)
    const result = await searchShipments(
      query,
      criteria.status,
      onProgress,
      signal,
    )
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (generation !== searchGeneration.current) throw new DOMException('다른 검색으로 대체됐습니다.', 'AbortError')
    if (result.search_mode === 'not_searched') return result
    startTransition(() => {
      setSemanticResults(result.shipments)
      setCriteria(current => ({ ...DEFAULT_CRITERIA, status: current.status }))
      setCriteriaResult(null)
      setAppliedCriteria(null)
      setResultSource('agent')
      setSelected(null)
      setLocating(false)
    })
    return result
  }

  const statusTotal = (shipmentStatus: ShipmentStatus) =>
    stats?.statuses.find((item) => item.status === shipmentStatus)?.count ?? 0

  return (
    <div className="app-shell" data-view={domain}>
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Boxes size={20} />
          </span>
          <div>
            <strong>HorizonDB Use Cases</strong>
            <span>{activeUseCase?.title ?? 'PostgreSQL extensions & AI in practice'}</span>
          </div>
        </div>

        <div className="capability-strip" aria-label="Platform capabilities" hidden={domain !== 'fleet'}>
          <span className={capabilities?.connected ? 'available' : 'standby'}>
            <Database size={14} />
            {capabilities?.connected ? 'HorizonDB live' : 'HorizonDB'}
          </span>
          <span className={capabilities?.postgis_version ? 'available' : 'standby'}>
            <MapIcon size={14} />
            PostGIS
          </span>
          <span className={capabilities?.diskann_version ? 'available' : 'standby'}>
            <PackageSearch size={14} />
            {capabilities?.diskann_spherical_quantization && capabilities.diskann_sq_bits === 4 ? 'SQ4 DiskANN' : 'DiskANN'}
          </span>
          <span className={capabilities?.agent_framework ? 'available' : 'standby'}>
            <Bot size={14} />
            Agent Framework
          </span>
        </div>

        <div className="capability-strip commerce-capabilities" aria-label="Home shopping technologies" hidden={domain !== 'commerce'}>
          <span title="주문·댓글·분석 결과·방송 대응 기록을 같은 HorizonDB에 저장합니다.">
            <Database size={14} />
            HorizonDB
          </span>
          <span title="주문·결제액·감정 비율을 SQL로 집계하고 화면을 2초 간격으로 갱신합니다.">
            <ChartNoAxesCombined size={14} />
            SQL Aggregation
          </span>
          <span title="Preview: 5초 경과 또는 10건 도달 시 묶은 댓글을 변경 기반 DB pipeline으로 분석합니다. LLM 추론은 연결된 외부 모델에서 수행합니다.">
            <Workflow size={14} />
            AI Pipelines
          </span>
        </div>

        <div className="network-state">
          {domain === 'fleet' && <><Radio size={15} aria-hidden="true" />
          <span>
            <strong>{stats?.total ?? shipments.length}</strong>
            tracked
          </span></>}
          {domain !== 'overview' && (
            <button type="button" className="case-home-button" onClick={() => navigate('overview')} aria-label="전체 사례로 돌아가기">
              <LayoutGrid size={16} aria-hidden="true" />
              전체 사례
            </button>
          )}
          <label className="domain-selector">
            <span>활용 사례</span>
            <select ref={caseNavigation} aria-label="활용 사례 선택" value={domain} onChange={event => {
              const next = event.currentTarget.value
              if (next === 'overview' || next === 'fleet' || next === 'commerce') navigate(next)
            }}>
              <option value="overview">전체 사례</option>
              {USE_CASES.map(useCase => <option key={useCase.id} value={useCase.id}>{useCase.title}</option>)}
            </select>
          </label>
        </div>
      </header>

      {domain === 'overview' && <UseCaseOverview onSelect={navigate} />}
      {fleetVisited && <div className="fleet-domain" hidden={domain !== 'fleet'}>
      {error ? (
        <div className="load-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadWorkspace()}>
            Retry
          </button>
        </div>
      ) : null}

      <main className={`workspace mobile-view-${mobileView}`}>
        <ShipmentList
          shipments={visibleShipments}
          total={visibleShipments.length}
          selectedNumber={selected?.shipment_number ?? null}
          criteria={criteria}
          result={criteriaResult}
          source={resultSource}
          dirty={JSON.stringify(criteria) !== JSON.stringify(appliedCriteria ?? DEFAULT_CRITERIA)}
          searching={criteriaSearching}
          searchError={criteriaError}
          pickingCenter={pickingCenter}
          loading={loading || criteriaSearching}
          onChange={patch => setCriteria(current => ({ ...current, ...patch }))}
          onSearch={() => void runCriteriaSearch()}
          onCancel={cancelCriteria}
          onPickCenter={() => {
            setPickingCenter(current => !current)
            setMobileView('map')
          }}
          onSelect={(shipment) => selectShipment(shipment, true)}
          onRefresh={() => void loadWorkspace()}
          onReset={showAllShipments}
          onOpenDemo={() => {
            setDemoOpen(true)
            setMobileView('map')
          }}
        />

        <section className="map-workspace" aria-label="Global shipment map">
          <div className="map-summary" aria-label="Shipment status summary">
            <span>
              <i className="summary-dot transit" />
              <b>{statusTotal('in_transit')}</b> in transit
            </span>
            <span>
              <i className="summary-dot delayed" />
              <b>{statusTotal('delayed')}</b> delayed
            </span>
            <span>
              <i className="summary-dot exception" />
              <b>{statusTotal('exception')}</b> exceptions
            </span>
            {semanticResults ? (
              <button type="button" onClick={showAllShipments}>
                Show all {shipments.length}
              </button>
            ) : null}
            {pickingCenter ? <button type="button" onClick={() => setPickingCenter(false)}>Cancel radius selection</button> : null}
          </div>
          <ShipmentMap
            shipments={visibleShipments}
            selected={selected}
            locateRequest={locating ? locateRequest : null}
            onSelect={(shipment) => selectShipment(shipment)}
            searchCenter={criteria.search_center}
            searchRadiusKm={criteria.radius_km}
            pickingCenter={pickingCenter}
            onPickCenter={pickSearchCenter}
          />
          {selected ? (
            <ShipmentDetail
              shipment={selected}
              outsideResults={selectionOutsideResults}
              onClose={clearSelection}
            />
          ) : null}
          <DemoDataPanel
            open={demoOpen}
            shipments={shipments}
            selected={selected}
            onClose={() => setDemoOpen(false)}
            onApplied={applyDemoShipments}
            onDeleted={removeDemoShipments}
            onVerify={verifyDemoData}
          />
        </section>

        <ChatPanel
          key={chatRevision}
          onSearch={runSemanticSearch}
          externalBusy={criteriaSearching}
          selectedNumber={selected?.shipment_number ?? null}
          onSelect={(shipment) => selectShipment(shipment, true)}
          onLocate={locateShipment}
          onShowAll={showAllShipments}
          queryRequest={queryRequest}
        />
      </main>

      <nav className="mobile-navigation" aria-label="Workspace views">
        <button
          type="button"
          className={mobileView === 'shipments' ? 'active' : ''}
          onClick={() => setMobileView('shipments')}
        >
          <Boxes size={19} />
          Shipments
        </button>
        <button
          type="button"
          className={mobileView === 'map' ? 'active' : ''}
          onClick={() => setMobileView('map')}
        >
          <MapIcon size={19} />
          Map
        </button>
        <button
          type="button"
          className={mobileView === 'assistant' ? 'active' : ''}
          onClick={() => setMobileView('assistant')}
        >
          <Bot size={19} />
          AI 도우미
        </button>
      </nav>
      </div>}
      {commerceVisited && <CommerceDashboard active={domain === 'commerce'} />}
    </div>
  )
}

export default App

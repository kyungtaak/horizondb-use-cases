export type Scene = 'normal' | 'shipping' | 'recovery'
export type Classification = {
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown'
  intents: string[]
  topics: string[]
  evidence: string
}
export type Comment = {
  comment_id: string
  run_id: string
  created_at: string
  content: string
  status: 'pending' | 'completed' | 'failed'
  classification: Classification | null
  error: string | null
  analyzed_at: string | null
}
export type Control = {
  action: 'start' | 'pause' | 'reset' | 'scene' | 'notice'
  scene?: Scene
  notice?: string
}
export type Trend = {
  minute: string
  orders: number
  negative: number
  classified: number
  comments: number
  pending: number
  failed: number
  unknown: number
}
export type Marker = {
  created_at: string
  note: string
  kind: 'scene' | 'notice'
  scene: Scene | null
}
export type Snapshot = {
  as_of: string
  window_seconds: number
  run: {
    id: string
    status: 'running' | 'paused'
    scene: Scene
    sequence: number
    created_at: string
    error: string | null
  } | null
  metrics: {
    received: number
    paid: number
    gross: number
    cancelled: number
    cancelled_amount: number
    net: number
    net_amount: number
    last_minute: number
    target: number
    channels: Record<string, number>
  }
  analysis: {
    total: number
    classified: number
    positive: number
    neutral: number
    negative: number
    unknown: number
    pending: number
    failed: number
    oldest_pending_seconds: number
    shipping_count: number
    alert: boolean
  }
  topics: { topic: string; count: number }[]
  comments: Comment[]
  trend: Trend[]
  markers: Marker[]
  timeline_seconds: number
  bucket_seconds: number
  recent_orders: {
    order_id: number; channel: string; paid_at: string | null; cancelled_at: string | null
  }[]
  briefing: {
    status: 'pending' | 'completed' | 'failed'
    requested_at: string
    data_as_of: string
    completed_at: string | null
    result: { summary: string; suggestion: string; evidence_ids: string[] } | null
    error: string | null
  } | null
  pipeline_error: string | null
  model_alias: string
}

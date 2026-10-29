import { apiRequest } from '../api'
import type { Control, Snapshot } from './types'
import { timelineModes } from './timeline'
import type { TimelineMode } from './timeline'

export function getCommerceSnapshot(
  windowSeconds: number, topic: string | null, signal?: AbortSignal, timeline: TimelineMode = 'short',
) {
  const mode = timelineModes[timeline]
  const params = new URLSearchParams({
    window_seconds: String(windowSeconds), timeline_seconds: String(mode.seconds),
    bucket_seconds: String(mode.bucket),
  })
  if (topic) params.set('topic', topic)
  return apiRequest<Snapshot>(`/api/commerce/snapshot?${params}`, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  })
}

export function controlCommerce(command: Control) {
  return apiRequest('/api/commerce/control', {
    method: 'POST', body: JSON.stringify(command), signal: AbortSignal.timeout(15000),
  })
}

export function refreshBriefing() {
  return apiRequest('/api/commerce/briefing', { method: 'POST', signal: AbortSignal.timeout(70000) })
}

export function retryCommerceAnalysis() {
  return apiRequest('/api/commerce/retry-analysis', { method: 'POST', signal: AbortSignal.timeout(15000) })
}

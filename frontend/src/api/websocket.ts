import { useAuthStore } from '@/store/auth'

type EventHandler = (event: RunEvent) => void

export interface RunEvent {
  sequenceId: number
  eventType: string
  payload: Record<string, unknown>
}

/**
 * Opens an SSE connection to stream run events.
 * Automatically sends Last-Event-ID on reconnect (browser does this natively).
 * Calls onReconnect when the connection is re-established after a failure.
 */
export function subscribeToRun(
  runId: string,
  onEvent: EventHandler,
  onReconnect?: () => void,
): () => void {
  const token = useAuthStore.getState().token
  const url = `/api/runs/${runId}/stream?token=${token}`

  let es: EventSource
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let delay = 1000
  let isFirstConnect = true

  function connect() {
    es = new EventSource(url)

    es.onopen = () => {
      delay = 1000
      if (!isFirstConnect && onReconnect) onReconnect()
      isFirstConnect = false
    }

    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data)
        const event: RunEvent = {
          sequenceId: Number(e.lastEventId),
          eventType: e.type || 'message',
          payload,
        }
        onEvent(event)
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      es.close()
      // Exponential backoff: 1s → 2s → 4s → 8s → max 30s
      reconnectTimer = setTimeout(() => {
        delay = Math.min(delay * 2, 30_000)
        connect()
      }, delay)
    }
  }

  connect()

  // Return cleanup function
  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    es?.close()
  }
}

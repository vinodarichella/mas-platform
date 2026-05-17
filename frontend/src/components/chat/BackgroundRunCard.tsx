import { useEffect, useRef, useState } from 'react'
import { Clock, CheckCircle2, XCircle, X, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { subscribeToRun, type RunEvent } from '@/api/websocket'
import { runsApi } from '@/api/runs'

interface Props {
  runId: string
  onComplete: (agentMessage: string | null) => void
  onDismiss: () => void
}

interface ProgressState {
  percent: number
  label: string
  step: number
  total: number
}

export function BackgroundRunCard({ runId, onComplete, onDismiss }: Props) {
  const [progress,  setProgress]  = useState<ProgressState | null>(null)
  const [status,    setStatus]    = useState<'running' | 'completed' | 'failed' | 'cancelled'>('running')
  const [agentMsg,  setAgentMsg]  = useState<string | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    unsubRef.current = subscribeToRun(runId, (ev: RunEvent) => {
      if (ev.eventType === 'progress') {
        setProgress({
          percent: Number(ev.payload.percent ?? 0),
          label:   String(ev.payload.label ?? ''),
          step:    Number(ev.payload.step ?? 0),
          total:   Number(ev.payload.total ?? 0),
        })
      } else if (ev.eventType === 'agent_message') {
        setAgentMsg(String(ev.payload.content ?? ''))
      } else if (ev.eventType === 'completed') {
        setStatus('completed')
        onComplete(agentMsg)
        unsubRef.current?.()
      } else if (ev.eventType === 'error' || ev.eventType === 'cancelled') {
        setStatus(ev.eventType === 'error' ? 'failed' : 'cancelled')
        unsubRef.current?.()
      }
    })

    return () => { unsubRef.current?.(); unsubRef.current = null }
  }, [runId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel() {
    await runsApi.cancel(runId)
    setStatus('cancelled')
    unsubRef.current?.()
    onDismiss()
  }

  const isTerminal = status !== 'running'

  return (
    <div className={clsx(
      'mx-4 mb-3 p-4 rounded-xl border transition-colors',
      status === 'running'   && 'bg-blue-950/30 border-blue-800',
      status === 'completed' && 'bg-green-950/30 border-green-800',
      status === 'failed'    && 'bg-red-950/30 border-red-800',
      status === 'cancelled' && 'bg-gray-800 border-gray-700',
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {status === 'running' && <Loader2 size={14} className="text-blue-400 animate-spin" />}
          {status === 'completed' && <CheckCircle2 size={14} className="text-green-400" />}
          {(status === 'failed' || status === 'cancelled') && <XCircle size={14} className="text-red-400" />}
          <span className={clsx(
            'text-xs font-medium',
            status === 'running'   && 'text-blue-300',
            status === 'completed' && 'text-green-300',
            status === 'failed'    && 'text-red-300',
            status === 'cancelled' && 'text-gray-400',
          )}>
            {status === 'running'   && 'Background job running…'}
            {status === 'completed' && 'Background job complete'}
            {status === 'failed'    && 'Background job failed'}
            {status === 'cancelled' && 'Background job cancelled'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {status === 'running' && (
            <button
              onClick={cancel}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button onClick={onDismiss} className="text-gray-500 hover:text-white transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {status === 'running' && (
        <>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progress?.percent ?? 5}%` }}
            />
          </div>
          {progress && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {progress.label}
              </span>
              <span>{progress.step}/{progress.total} steps ({progress.percent}%)</span>
            </div>
          )}
        </>
      )}

      {/* Run ID */}
      <p className="text-xs text-gray-700 mt-2 font-mono">{runId.slice(0, 8)}…</p>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Activity, CheckCircle2, XCircle, Clock, AlertCircle,
  PauseCircle, ChevronDown, ChevronRight, X, RefreshCw,
} from 'lucide-react'
import { clsx } from 'clsx'
import { runsApi, type Run } from '@/api/runs'
import { subscribeToRun, type RunEvent } from '@/api/websocket'
import { ThinkingPanel } from '@/components/chat/ThinkingPanel'

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  queued:      { icon: Clock,         color: 'text-gray-400',   label: 'Queued'      },
  running:     { icon: Activity,      color: 'text-blue-400',   label: 'Running'     },
  completed:   { icon: CheckCircle2,  color: 'text-green-400',  label: 'Completed'   },
  failed:      { icon: XCircle,       color: 'text-red-400',    label: 'Failed'      },
  cancelled:   { icon: AlertCircle,   color: 'text-gray-500',   label: 'Cancelled'   },
  paused_hitl: { icon: PauseCircle,   color: 'text-yellow-400', label: 'Awaiting Input' },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.queued
  const Icon = meta.icon
  return (
    <span className={clsx('flex items-center gap-1.5 text-xs font-medium', meta.color)}>
      <Icon size={12} className={status === 'running' ? 'animate-pulse' : ''} />
      {meta.label}
    </span>
  )
}

function elapsed(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime()
  const end   = completedAt ? new Date(completedAt).getTime() : Date.now()
  const secs  = Math.round((end - start) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  return `${mins}m ${secs % 60}s`
}

// ── Live run viewer ───────────────────────────────────────────────────────────

function RunViewer({ run, onClose }: { run: Run; onClose: () => void }) {
  const [events,       setEvents]       = useState<RunEvent[]>([])
  const [agentMessage, setAgentMessage] = useState('')
  const [streaming,    setStreaming]    = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
      // Subscribe to replay past events for this run
      setStreaming(false)
    } else {
      setStreaming(true)
    }

    unsubRef.current = subscribeToRun(run.id, (ev) => {
      if (ev.eventType === 'agent_message') {
        setAgentMessage((ev.payload.content as string) ?? '')
      } else if (['completed', 'error', 'cancelled'].includes(ev.eventType)) {
        setStreaming(false)
        unsubRef.current?.()
        unsubRef.current = null
      } else if (ev.eventType !== 'keepalive') {
        setEvents(e => [...e, ev])
      }
    })

    return () => {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [run.id, run.status])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events, agentMessage])

  const inputMessage = (run.inputData as Record<string, string>)?.message ?? ''

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-gray-900 border-l border-gray-800
                    flex flex-col shadow-2xl z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div>
          <p className="text-sm font-semibold text-white font-mono">
            {run.id.slice(0, 8)}…
          </p>
          <StatusBadge status={run.status} />
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Input */}
        {inputMessage && (
          <div className="flex justify-end">
            <div className="max-w-[85%] px-3 py-2 bg-blue-600 rounded-lg rounded-br-sm text-sm text-white">
              {inputMessage}
            </div>
          </div>
        )}

        {/* Events (thinking panel) */}
        {events.length > 0 && (
          <ThinkingPanel events={events} />
        )}

        {/* Agent reply */}
        {agentMessage && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3 py-2 bg-gray-800 rounded-lg rounded-bl-sm
                            text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
              {agentMessage}
              {streaming && (
                <span className="inline-block w-1.5 h-3.5 bg-gray-400 ml-0.5 animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {run.status === 'failed' && run.errorMessage && (
          <div className="px-3 py-2 bg-red-950/50 border border-red-800 rounded-lg">
            <p className="text-xs text-red-400">{run.errorMessage}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
        <p>Type: <span className="text-gray-400">{run.jobType}</span></p>
        <p>Started: <span className="text-gray-400">{new Date(run.startedAt).toLocaleString()}</span></p>
        <p>Elapsed: <span className="text-gray-400">{elapsed(run.startedAt, run.completedAt)}</span></p>
      </div>
    </div>
  )
}

// ── Run row ───────────────────────────────────────────────────────────────────

function RunRow({ run, onSelect }: { run: Run; onSelect: () => void }) {
  const inputMsg = (run.inputData as Record<string, string>)?.message ?? ''

  return (
    <div
      onClick={onSelect}
      className="flex items-start gap-4 p-4 bg-gray-800 border border-gray-700 rounded-xl
                 hover:border-gray-600 cursor-pointer transition-colors group"
    >
      <div className="flex-shrink-0 pt-0.5">
        {(() => {
          const meta = STATUS_META[run.status] ?? STATUS_META.queued
          const Icon = meta.icon
          return <Icon size={16} className={clsx(meta.color, run.status === 'running' ? 'animate-pulse' : '')} />
        })()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-gray-500">{run.id.slice(0, 8)}</span>
          <StatusBadge status={run.status} />
          <span className="text-xs text-gray-600 capitalize ml-auto">{run.jobType}</span>
        </div>
        {inputMsg && (
          <p className="text-sm text-gray-300 truncate">{inputMsg}</p>
        )}
        <p className="text-xs text-gray-600 mt-1">
          {new Date(run.startedAt).toLocaleString()} · {elapsed(run.startedAt, run.completedAt)}
        </p>
      </div>

      <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0 mt-1 transition-colors" />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Runs() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Run | null>(null)
  const [filter,   setFilter]   = useState<string>('all')

  const { data: runs = [], isLoading, refetch } = useQuery({
    queryKey: ['runs'],
    queryFn: runsApi.list,
    refetchInterval: (data) => {
      // Auto-refresh every 5 s if any run is still active
      const active = (data?.state?.data ?? []).some(
        (r: Run) => r.status === 'running' || r.status === 'queued',
      )
      return active ? 5_000 : false
    },
  })

  const cancelMut = useMutation({
    mutationFn: runsApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runs'] }),
  })

  const filterOptions = [
    { value: 'all',     label: 'All' },
    { value: 'running', label: 'Running' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed',  label: 'Failed' },
  ]

  const filtered = runs.filter(r =>
    filter === 'all' || r.status === filter ||
    (filter === 'failed' && (r.status === 'failed' || r.status === 'cancelled')),
  )

  return (
    <div className="flex h-full gap-0 overflow-hidden relative">
      {/* Main list */}
      <div className={clsx(
        'flex-1 flex flex-col min-w-0 transition-all',
        selected && 'lg:mr-[520px]',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Runs</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {runs.length} execution{runs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-gray-800 rounded-lg w-fit">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                filter === opt.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity size={40} className="text-gray-700 mb-3" />
            <p className="text-gray-400 font-medium">
              {filter === 'all' ? 'No runs yet' : `No ${filter} runs`}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              {filter === 'all' ? 'Start a chat or run a workflow to see executions here' : ''}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map(run => (
            <RunRow
              key={run.id}
              run={run}
              onSelect={() => setSelected(run)}
            />
          ))}
        </div>
      </div>

      {/* Side panel */}
      {selected && (
        <RunViewer
          run={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

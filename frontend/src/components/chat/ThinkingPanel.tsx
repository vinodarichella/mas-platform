import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench, Brain, CheckCircle, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { RunEvent } from '@/api/websocket'

interface Props {
  events: RunEvent[]
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  thinking:      { icon: Brain,        label: 'Thinking',    color: 'text-purple-400' },
  planning:      { icon: Brain,        label: 'Planning',    color: 'text-blue-400'   },
  tool_call:     { icon: Wrench,       label: 'Tool Call',   color: 'text-orange-400' },
  tool_result:   { icon: CheckCircle,  label: 'Tool Result', color: 'text-green-400'  },
  step_start:    { icon: ChevronRight, label: 'Step Start',  color: 'text-gray-400'   },
  step_end:      { icon: CheckCircle,  label: 'Step Done',   color: 'text-green-500'  },
  error:         { icon: AlertCircle,  label: 'Error',       color: 'text-red-400'    },
}

function EventRow({ event }: { event: RunEvent }) {
  const [open, setOpen] = useState(false)
  const cfg = EVENT_CONFIG[event.eventType] ?? { icon: Brain, label: event.eventType, color: 'text-gray-400' }
  const Icon = cfg.icon
  const hasDetail = Object.keys(event.payload).length > 0

  const summary = (event.payload.content as string)
    || (event.payload.name as string)
    || (event.payload.step as string)
    || (event.payload.message as string)
    || ''

  return (
    <div className="text-xs">
      <button
        onClick={() => hasDetail && setOpen(o => !o)}
        className={clsx(
          'flex items-start gap-2 w-full text-left py-1 rounded',
          hasDetail && 'hover:bg-gray-800 cursor-pointer',
          !hasDetail && 'cursor-default',
        )}
      >
        <Icon size={12} className={clsx('mt-0.5 flex-shrink-0', cfg.color)} />
        <span className={clsx('font-medium', cfg.color)}>{cfg.label}</span>
        {summary && (
          <span className="text-gray-400 truncate">{summary.slice(0, 80)}</span>
        )}
        {hasDetail && (
          open
            ? <ChevronDown size={10} className="ml-auto mt-0.5 text-gray-500" />
            : <ChevronRight size={10} className="ml-auto mt-0.5 text-gray-500" />
        )}
      </button>
      {open && (
        <pre className="ml-4 mt-1 p-2 bg-gray-900 rounded text-gray-400 overflow-x-auto text-xs">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function ThinkingPanel({ events }: Props) {
  const visible = events.filter(e => e.eventType !== 'agent_message'
    && e.eventType !== 'completed'
    && e.eventType !== 'keepalive')

  if (visible.length === 0) return null

  return (
    <div className="mx-4 mb-2 p-3 bg-gray-900 border border-gray-800 rounded-lg">
      <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
        <Brain size={11} />
        Agent activity
      </p>
      <div className="space-y-0.5">
        {visible.map((ev, i) => <EventRow key={i} event={ev} />)}
      </div>
    </div>
  )
}

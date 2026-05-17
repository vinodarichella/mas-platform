import { useState } from 'react'
import {
  Plus, MessageSquare, Trash2, Loader2,
  GitBranch, X, ChevronDown,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi, type Session } from '@/api/sessions'
import { workflowsApi, type WorkflowDto } from '@/api/workflows'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { clsx } from 'clsx'

// ── Create session modal ──────────────────────────────────────────────────────

function CreateSessionModal({
  workflows,
  onConfirm,
  onCancel,
  isPending,
}: {
  workflows: WorkflowDto[]
  onConfirm: (name: string, workflowId?: string) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [name,       setName]       = useState('New Session')
  const [workflowId, setWorkflowId] = useState('')

  function submit() {
    if (!name.trim()) return
    onConfirm(name.trim(), workflowId || undefined)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl">
        <h4 className="text-sm font-semibold text-white mb-4">New Session</h4>

        <label className="block text-xs text-gray-400 mb-1.5">Session name</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg
                     text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 mb-4"
        />

        <label className="block text-xs text-gray-400 mb-1.5">
          Workflow <span className="text-gray-600">(optional)</span>
        </label>
        <select
          value={workflowId}
          onChange={e => setWorkflowId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg
                     text-sm text-white focus:outline-none focus:border-blue-500 mb-1"
        >
          <option value="">— Default agent (no workflow) —</option>
          {workflows.map(w => (
            <option key={w.id} value={w.id}>{w.name} ({w.orchestrationType})</option>
          ))}
        </select>
        <p className="text-xs text-gray-600 mb-5">
          Bind a workflow to run multi-agent pipelines in this session.
        </p>

        <div className="flex gap-3">
          <button
            disabled={!name.trim() || isPending}
            onClick={submit}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                       text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isPending ? 'Creating…' : 'Create'}
          </button>
          <button onClick={onCancel} className="flex-1 py-2 text-gray-400 hover:text-white text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Workflow picker (inline in session header) ────────────────────────────────

function WorkflowPicker({
  currentId,
  workflows,
  onSelect,
  onClose,
}: {
  currentId: string | null
  workflows: WorkflowDto[]
  onSelect: (id: string | null) => void
  onClose: () => void
}) {
  return (
    <div className="absolute top-full left-0 mt-1 w-72 bg-gray-800 border border-gray-700
                    rounded-lg shadow-xl z-30 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700">
        <p className="text-xs font-medium text-gray-400">Bind workflow to session</p>
      </div>

      <div className="max-h-52 overflow-y-auto">
        <button
          onClick={() => { onSelect(null); onClose() }}
          className={clsx(
            'w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors',
            !currentId ? 'text-blue-400' : 'text-gray-400',
          )}
        >
          — Default agent (no workflow) —
        </button>
        {workflows.map(w => (
          <button
            key={w.id}
            onClick={() => { onSelect(w.id); onClose() }}
            className={clsx(
              'w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors',
              currentId === w.id ? 'text-blue-400' : 'text-gray-300',
            )}
          >
            <span className="text-xs font-medium block truncate">{w.name}</span>
            <span className="text-xs text-gray-500 capitalize">{w.orchestrationType}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Session header ────────────────────────────────────────────────────────────

function SessionHeader({
  session,
  workflows,
}: {
  session: Session
  workflows: WorkflowDto[]
}) {
  const qc = useQueryClient()
  const [showPicker, setShowPicker] = useState(false)

  const boundWorkflow = workflows.find(w => w.id === session.workflowId)

  const bindMut = useMutation({
    mutationFn: (workflowId: string | null) => sessionsApi.bindWorkflow(session.id, workflowId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })

  return (
    <div className="px-5 py-3 border-b border-gray-800 flex-shrink-0 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-medium text-white truncate">{session.name}</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Last active {new Date(session.lastActiveAt).toLocaleString()}
        </p>
      </div>

      {/* Workflow binding button */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowPicker(v => !v)}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors',
            boundWorkflow
              ? 'border-blue-700 text-blue-400 bg-blue-900/20 hover:bg-blue-900/30'
              : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600',
          )}
        >
          <GitBranch size={11} />
          <span className="max-w-28 truncate">
            {boundWorkflow ? boundWorkflow.name : 'No workflow'}
          </span>
          <ChevronDown size={10} className={clsx('transition-transform', showPicker && 'rotate-180')} />
        </button>

        {showPicker && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowPicker(false)} />
            <WorkflowPicker
              currentId={session.workflowId ?? null}
              workflows={workflows}
              onSelect={id => bindMut.mutate(id)}
              onClose={() => setShowPicker(false)}
            />
          </>
        )}
      </div>

      {/* Spinner while binding */}
      {bindMut.isPending && <Loader2 size={12} className="animate-spin text-gray-500 flex-shrink-0" />}

      {/* Unlink shortcut when bound */}
      {boundWorkflow && !bindMut.isPending && (
        <button
          onClick={() => bindMut.mutate(null)}
          title="Unbind workflow"
          className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({
  session,
  active,
  hasWorkflow,
  onSelect,
  onDelete,
}: {
  session: Session
  active: boolean
  hasWorkflow: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={clsx(
        'group flex items-center gap-2 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
        active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white',
      )}
    >
      <MessageSquare size={13} className="flex-shrink-0" />
      <span className="flex-1 text-sm truncate">{session.name}</span>
      {hasWorkflow && (
        <span title="Workflow bound">
          <GitBranch size={10} className="flex-shrink-0 text-blue-500 opacity-70" />
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700
                   text-gray-500 hover:text-red-400 transition-all"
        title="Delete session"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function Sessions() {
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [creating,   setCreating]   = useState(false)
  const qc = useQueryClient()

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
  })

  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, workflowId }: { name: string; workflowId?: string }) =>
      sessionsApi.create(name, workflowId),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      setCreating(false)
      setActiveId(session.id)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      if (activeId === id) setActiveId(null)
    },
  })

  const activeSession = sessions.find(s => s.id === activeId)

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      {/* ── Session list sidebar ───────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium text-white">Sessions</span>
          <button
            onClick={() => setCreating(true)}
            disabled={createMutation.isPending}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800
                       transition-colors disabled:opacity-50"
            title="New session"
          >
            {createMutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Plus size={14} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading && (
            <div className="flex justify-center pt-8">
              <Loader2 size={16} className="animate-spin text-gray-500" />
            </div>
          )}

          {!isLoading && sessions.length === 0 && (
            <div className="px-4 pt-8 text-center">
              <MessageSquare size={24} className="mx-auto text-gray-600 mb-2" />
              <p className="text-xs text-gray-500">No sessions yet.</p>
              <button
                onClick={() => setCreating(true)}
                className="mt-3 text-xs text-blue-400 hover:underline"
              >
                Create one
              </button>
            </div>
          )}

          {sessions.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              active={session.id === activeId}
              hasWorkflow={!!session.workflowId}
              onSelect={() => setActiveId(session.id)}
              onDelete={() => deleteMutation.mutate(session.id)}
            />
          ))}
        </div>
      </aside>

      {/* ── Chat area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeSession ? (
          <>
            <SessionHeader session={activeSession} workflows={workflows} />
            <ChatWindow sessionId={activeSession.id} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageSquare size={40} className="text-gray-700 mb-4" />
            <h3 className="text-base font-medium text-gray-400 mb-2">No session selected</h3>
            <p className="text-sm text-gray-600 mb-6">
              Select an existing session or create a new one to start chatting.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                         text-white rounded-lg text-sm transition-colors"
            >
              <Plus size={14} />
              New Session
            </button>
          </div>
        )}
      </div>

      {/* Create modal */}
      {creating && (
        <CreateSessionModal
          workflows={workflows}
          isPending={createMutation.isPending}
          onConfirm={(name, workflowId) => createMutation.mutate({ name, workflowId })}
          onCancel={() => setCreating(false)}
        />
      )}
    </div>
  )
}

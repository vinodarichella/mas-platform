import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi, type Session } from '@/api/sessions'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { clsx } from 'clsx'

export function Sessions() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: sessionsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: () => sessionsApi.create('New Session'),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
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
      {/* ── Session list sidebar ─────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium text-white">Sessions</span>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800
                       transition-colors disabled:opacity-50"
            title="New session"
          >
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
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
                onClick={() => createMutation.mutate()}
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
              onSelect={() => setActiveId(session.id)}
              onDelete={() => deleteMutation.mutate(session.id)}
            />
          ))}
        </div>
      </aside>

      {/* ── Chat area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeSession ? (
          <>
            <div className="px-5 py-3 border-b border-gray-800 flex-shrink-0">
              <h2 className="text-sm font-medium text-white">{activeSession.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Last active {new Date(activeSession.lastActiveAt).toLocaleString()}
              </p>
            </div>
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
              onClick={() => createMutation.mutate()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                         text-white rounded-lg text-sm transition-colors"
            >
              <Plus size={14} />
              New Session
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SessionRow({
  session,
  active,
  onSelect,
  onDelete,
}: {
  session: Session
  active: boolean
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

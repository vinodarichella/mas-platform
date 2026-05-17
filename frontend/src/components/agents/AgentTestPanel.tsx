import { useState, useRef, useEffect } from 'react'
import { Send, FlaskConical, X } from 'lucide-react'
import { agentsApi } from '@/api/agents'
import { subscribeToRun, type RunEvent } from '@/api/websocket'
import { ThinkingPanel } from '@/components/chat/ThinkingPanel'
import { clsx } from 'clsx'

interface Props {
  agentId: string
}

interface TestMessage {
  role: 'user' | 'agent'
  content: string
}

export function AgentTestPanel({ agentId }: Props) {
  const [input, setInput]           = useState('')
  const [messages, setMessages]     = useState<TestMessage[]>([])
  const [events, setEvents]         = useState<RunEvent[]>([])
  const [streaming, setStreaming]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const unsubRef                    = useRef<(() => void) | null>(null)
  const bottomRef                   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, events])

  useEffect(() => () => { unsubRef.current?.() }, [])

  async function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    setError(null)
    setMessages(m => [...m, { role: 'user', content: text }])
    setEvents([])
    setStreaming(true)

    try {
      const { runId } = await agentsApi.test(agentId, text)
      let agentReply = ''

      unsubRef.current = subscribeToRun(runId, (ev) => {
        if (ev.eventType === 'agent_message') {
          const chunk = (ev.payload.content as string) ?? ''
          agentReply = chunk
          setMessages(m => {
            const last = m[m.length - 1]
            if (last?.role === 'agent') {
              return [...m.slice(0, -1), { role: 'agent', content: chunk }]
            }
            return [...m, { role: 'agent', content: chunk }]
          })
        } else if (['completed', 'error', 'cancelled'].includes(ev.eventType)) {
          if (ev.eventType === 'error') {
            const msg = (ev.payload.message as string) ?? 'Unknown error'
            setError(msg)
            if (!agentReply) setMessages(m => m.filter(m => m.role !== 'agent' || m.content))
          }
          setStreaming(false)
          setEvents([])
          unsubRef.current?.()
          unsubRef.current = null
        } else {
          setEvents(e => [...e, ev])
        }
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start test run')
      setStreaming(false)
    }
  }

  function clearAll() {
    unsubRef.current?.()
    unsubRef.current = null
    setMessages([])
    setEvents([])
    setStreaming(false)
    setError(null)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <FlaskConical size={13} />
          Test Agent
        </p>
        {messages.length > 0 && (
          <button onClick={clearAll} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 && !streaming && (
          <p className="text-xs text-gray-600 text-center py-4">
            Send a message to test this agent
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={clsx(
              'max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap',
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-gray-800 text-gray-200 rounded-bl-sm',
            )}>
              {msg.content}
              {msg.role === 'agent' && streaming && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-3.5 bg-gray-400 ml-0.5 animate-pulse rounded-sm" />
              )}
            </div>
          </div>
        ))}

        {streaming && events.length > 0 && <ThinkingPanel events={events} />}

        {error && (
          <p className="text-xs text-red-400 px-2">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg
                     text-sm text-white placeholder-gray-600
                     focus:outline-none focus:border-blue-500 disabled:opacity-50"
          placeholder="Type a test message…"
          value={input}
          disabled={streaming}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                     disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

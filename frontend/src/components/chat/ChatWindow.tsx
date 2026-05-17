import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, WifiOff, Clock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi, type ChatMessage } from '@/api/sessions'
import { subscribeToRun, type RunEvent } from '@/api/websocket'
import { MessageBubble }     from './MessageBubble'
import { ThinkingPanel }     from './ThinkingPanel'
import { HitlModal }         from './HitlModal'
import { BackgroundRunCard } from './BackgroundRunCard'

interface Props {
  sessionId: string
}

interface HitlState {
  runId: string
  hitlId: string
  prompt: string
}

interface BackgroundRun {
  runId: string
}

export function ChatWindow({ sessionId }: Props) {
  const [input,         setInput]        = useState('')
  const [runEvents,     setRunEvents]    = useState<RunEvent[]>([])
  const [isStreaming,   setIsStreaming]  = useState(false)
  const [reconnecting,  setReconnecting] = useState(false)
  const [hitl,          setHitl]        = useState<HitlState | null>(null)
  const [bgRuns,        setBgRuns]       = useState<BackgroundRun[]>([])
  const [progress,      setProgress]     = useState<{ percent: number; label: string } | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const qc         = useQueryClient()
  const unsubRef   = useRef<(() => void) | null>(null)

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', sessionId],
    queryFn: () => sessionsApi.messages(sessionId),
    enabled: !!sessionId,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, runEvents, bgRuns])

  const startStream = useCallback((runId: string, isBackground: boolean) => {
    if (isBackground) {
      setBgRuns(prev => [...prev, { runId }])
      return
    }

    setRunEvents([])
    setProgress(null)
    setHitl(null)
    setIsStreaming(true)

    unsubRef.current?.()
    unsubRef.current = subscribeToRun(
      runId,
      (event) => {
        if (event.eventType === 'progress') {
          setProgress({
            percent: Number(event.payload.percent ?? 0),
            label:   String(event.payload.label ?? ''),
          })
        } else if (event.eventType === 'hitl_request') {
          // Pause UI — show HITL modal
          setHitl({
            runId,
            hitlId: String(event.payload.hitl_id ?? ''),
            prompt: String(event.payload.prompt ?? 'Please provide input'),
          })
        } else if (event.eventType === 'hitl_response') {
          // HITL resolved — hide modal, continue stream
          setHitl(null)
        } else {
          setRunEvents(prev => [...prev, event])
        }

        if (['completed', 'error', 'cancelled'].includes(event.eventType)) {
          setIsStreaming(false)
          setReconnecting(false)
          setProgress(null)
          setTimeout(() => {
            qc.invalidateQueries({ queryKey: ['messages', sessionId] })
            setRunEvents([])
          }, 400)
        }
      },
      () => setReconnecting(false),
    )
  }, [sessionId, qc])

  const chatMutation = useMutation({
    mutationFn: (opts: { message: string; background: boolean }) =>
      sessionsApi.chat(sessionId, opts.message, opts.background),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['messages', sessionId] })
      startStream(data.runId, vars.background)
    },
  })

  function handleSend(background = false) {
    const msg = input.trim()
    if (!msg || isStreaming) return
    setInput('')
    chatMutation.mutate({ message: msg, background })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(false)
    }
  }

  // Streaming content from events
  const streamingContent = runEvents
    .filter(e => e.eventType === 'agent_message')
    .map(e => (e.payload.content as string) ?? '')
    .join('')

  const streamingMessage: ChatMessage | null = streamingContent
    ? { id: 'streaming', role: 'agent', content: streamingContent, sequenceId: -1, createdAt: '' }
    : null

  const thinkingEvents = runEvents.filter(e => e.eventType !== 'agent_message')

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* HITL modal — overlays chat when agent needs human input */}
      {hitl && (
        <HitlModal
          runId={hitl.runId}
          hitlId={hitl.hitlId}
          prompt={hitl.prompt}
          onDismiss={() => setHitl(null)}
        />
      )}

      {/* Reconnecting banner */}
      {reconnecting && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-900/40 border-b border-yellow-800 text-xs text-yellow-300">
          <WifiOff size={12} />
          Connection lost — reconnecting…
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {messages.length === 0 && !isStreaming && bgRuns.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-500">Send a message to start the conversation.</p>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Background run cards */}
        {bgRuns.map(br => (
          <BackgroundRunCard
            key={br.runId}
            runId={br.runId}
            onComplete={(msg) => {
              if (msg) qc.invalidateQueries({ queryKey: ['messages', sessionId] })
              setBgRuns(prev => prev.filter(r => r.runId !== br.runId))
            }}
            onDismiss={() => setBgRuns(prev => prev.filter(r => r.runId !== br.runId))}
          />
        ))}

        {/* Progress indicator */}
        {isStreaming && progress && (
          <div className="mx-4 mb-1">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {progress.label}
              </span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Thinking panel */}
        <ThinkingPanel events={thinkingEvents} />

        {/* Streaming agent response */}
        {streamingMessage && (
          <MessageBubble message={streamingMessage} streaming />
        )}

        {/* Thinking spinner while waiting for first event */}
        {isStreaming && !streamingMessage && thinkingEvents.length === 0 && !progress && (
          <div className="flex gap-3 px-4 py-2">
            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center">
              <Loader2 size={14} className="animate-spin text-gray-400" />
            </div>
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4">
        <div className="flex gap-2 p-2 bg-gray-900 border border-gray-700 rounded-xl
                        focus-within:border-blue-600 transition-colors">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600
                       resize-none focus:outline-none py-1.5 px-2 max-h-32"
          />

          {/* Background run button */}
          <button
            onClick={() => handleSend(true)}
            disabled={!input.trim() || isStreaming}
            title="Run in background (for long tasks)"
            className="self-end p-2 text-gray-500 hover:text-gray-300 disabled:opacity-30
                       rounded-lg transition-colors flex-shrink-0"
          >
            <Clock size={16} />
          </button>

          {/* Send button */}
          <button
            onClick={() => handleSend(false)}
            disabled={!input.trim() || isStreaming}
            className="self-end p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40
                       rounded-lg transition-colors flex-shrink-0"
          >
            {isStreaming
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>

        <p className="text-xs text-gray-700 mt-1.5 px-1">
          Click <Clock size={10} className="inline" /> to run as a long background task
        </p>
      </div>
    </div>
  )
}

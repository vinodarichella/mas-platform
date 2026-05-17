import { useState } from 'react'
import { UserCheck, Send, Loader2 } from 'lucide-react'
import { runsApi } from '@/api/runs'

interface Props {
  runId: string
  hitlId: string
  prompt: string
  onDismiss: () => void
}

export function HitlModal({ runId, hitlId, prompt, onDismiss }: Props) {
  const [response, setResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const text = response.trim()
    if (!text || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await runsApi.submitHitl(runId, hitlId, { text })
      onDismiss()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit response')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-pink-800 rounded-2xl
                      shadow-2xl shadow-pink-900/30 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-pink-950/30">
          <div className="w-8 h-8 rounded-full bg-pink-600/30 flex items-center justify-center flex-shrink-0">
            <UserCheck size={16} className="text-pink-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-pink-300">Human Review Required</p>
            <p className="text-xs text-gray-500 mt-0.5">The agent has paused and needs your input to continue</p>
          </div>
        </div>

        {/* Prompt */}
        <div className="px-6 py-4">
          <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 mb-4">
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{prompt}</p>
          </div>

          <label className="block text-xs font-medium text-gray-400 mb-2">Your response</label>
          <textarea
            autoFocus
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                       text-sm text-white placeholder-gray-600 resize-none
                       focus:outline-none focus:border-pink-500 transition-colors"
            rows={4}
            placeholder="Type your response here…"
            value={response}
            disabled={submitting}
            onChange={e => setResponse(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
          />
          <p className="text-xs text-gray-600 mt-1.5">Cmd/Ctrl + Enter to submit</p>

          {error && (
            <p className="text-xs text-red-400 mt-2">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={submit}
            disabled={!response.trim() || submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5
                       bg-pink-600 hover:bg-pink-700 disabled:opacity-50
                       text-white rounded-xl text-sm font-medium transition-colors"
          >
            {submitting
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />
            }
            {submitting ? 'Submitting…' : 'Submit Response'}
          </button>
        </div>
      </div>
    </div>
  )
}

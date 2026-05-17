import { useQuery } from '@tanstack/react-query'
import { agentsApi } from '@/api/agents'
import { clsx } from 'clsx'

interface Props {
  provider: string
  model: string
  onProviderChange: (p: string) => void
  onModelChange: (m: string) => void
}

const PROVIDER_LABELS: Record<string, string> = {
  azure:       'Azure OpenAI',
  databricks:  'Databricks',
  openai:      'OpenAI',
  anthropic:   'Anthropic',
  gemini:      'Google Gemini',
}

export function ProviderModelPicker({ provider, model, onProviderChange, onModelChange }: Props) {
  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: agentsApi.providers,
    staleTime: 60_000,
  })

  const allProviders   = providers?.all ?? {}
  const configured     = providers?.configured ?? {}
  const providerList   = Object.keys(allProviders)
  const availableModels: string[] = allProviders[provider] ?? []

  function handleProviderChange(p: string) {
    onProviderChange(p)
    // Reset model to first available for new provider
    const firstModel = (allProviders[p] ?? [])[0] ?? ''
    onModelChange(firstModel)
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Provider */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Provider</label>
        <select
          value={provider}
          onChange={e => handleProviderChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                     text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">Select provider…</option>
          {providerList.map(p => (
            <option key={p} value={p}>
              {PROVIDER_LABELS[p] ?? p}
              {configured[p] ? ' ✓' : ''}
            </option>
          ))}
        </select>
        {provider && !configured[provider] && (
          <p className="text-xs text-yellow-500 mt-1">
            API key not configured — set in .env
          </p>
        )}
      </div>

      {/* Model */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Model</label>
        <select
          value={model}
          onChange={e => onModelChange(e.target.value)}
          disabled={!provider}
          className={clsx(
            'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg',
            'text-sm text-white focus:outline-none focus:border-blue-500',
            !provider && 'opacity-50 cursor-not-allowed',
          )}
        >
          <option value="">Select model…</option>
          {availableModels.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
          {/* Allow custom model entry */}
          {model && !availableModels.includes(model) && (
            <option value={model}>{model} (custom)</option>
          )}
        </select>
      </div>
    </div>
  )
}

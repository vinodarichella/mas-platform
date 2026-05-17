import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import { api } from '@/api/client'

interface UserProfile {
  id: string
  email: string
  name: string
  preferences: Record<string, string>
}

export function Profile() {
  const [prefs, setPrefs] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: () => api.get('/users/me').then(r => r.data),
  })

  useEffect(() => {
    if (profile?.preferences) setPrefs(profile.preferences as Record<string, string>)
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: (p: Record<string, string>) =>
      api.put('/users/me/preferences', p).then(r => r.data),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const defaultPrefs = [
    { key: 'preferred_model',    label: 'Preferred model',    placeholder: 'gpt-4o',        hint: 'Overrides the default model for agents that support it' },
    { key: 'language',           label: 'Preferred language', placeholder: 'English',        hint: 'Agents will respond in this language when possible' },
    { key: 'response_style',     label: 'Response style',     placeholder: 'concise',        hint: 'e.g. concise, detailed, bullet-points, formal' },
    { key: 'expertise_level',    label: 'Expertise level',    placeholder: 'intermediate',   hint: 'e.g. beginner, intermediate, expert — adjusts explanation depth' },
    { key: 'domain_focus',       label: 'Domain focus',       placeholder: 'software engineering', hint: 'Your primary domain or industry — helps agents tailor context' },
    { key: 'tone',               label: 'Tone preference',    placeholder: 'professional',   hint: 'e.g. professional, casual, friendly, direct' },
    { key: 'output_format',      label: 'Output format',      placeholder: 'markdown',       hint: 'e.g. markdown, plain text, JSON — preferred format for responses' },
  ]

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 size={20} className="animate-spin text-gray-500" />
    </div>
  )

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">Profile</h2>
        <p className="text-gray-400 text-sm mt-1">
          Preferences are injected into every agent's system prompt.
        </p>
      </div>

      {/* Account info (read-only) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400">Account</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name"  value={profile?.name  ?? ''} readOnly />
          <Field label="Email" value={profile?.email ?? ''} readOnly />
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-400">Personalization</h3>

        <div className="space-y-3">
          {defaultPrefs.map(({ key, label, placeholder, hint }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input
                value={prefs[key] ?? ''}
                onChange={e => setPrefs(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                           text-sm text-white placeholder-gray-600 focus:outline-none
                           focus:border-blue-500"
              />
              {hint && <p className="text-xs text-gray-600 mt-0.5">{hint}</p>}
            </div>
          ))}
        </div>

        <button
          onClick={() => saveMutation.mutate(prefs)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                     disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
        >
          {saveMutation.isPending
            ? <Loader2 size={14} className="animate-spin" />
            : <Save size={14} />}
          {saved ? 'Saved!' : 'Save preferences'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, readOnly }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        value={value}
        readOnly={readOnly}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                   text-sm text-gray-300 focus:outline-none read-only:opacity-70"
      />
    </div>
  )
}

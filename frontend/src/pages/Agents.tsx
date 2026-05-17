import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Bot, ChevronRight, X, Wrench, Server, Globe } from 'lucide-react'
import { agentsApi, type AgentDto, type AgentRequest, type Tool } from '@/api/agents'
import { ProviderModelPicker } from '@/components/agents/ProviderModelPicker'
import { ToolsEditor } from '@/components/agents/ToolsEditor'
import { AgentTestPanel } from '@/components/agents/AgentTestPanel'
import { clsx } from 'clsx'

// ── Types ────────────────────────────────────────────────────────────────────

type DrawerMode = 'create' | 'edit'

interface FormState {
  name: string
  instructions: string
  provider: string
  model: string
  tools: Tool[]
  skills: string
  middleware: string
  memoryEnabled: boolean
  runMode: 'interactive' | 'background'
  maxRunDurationMinutes: number
  personalizationPrompt: string
}

const defaultForm = (): FormState => ({
  name: '',
  instructions: '',
  provider: '',
  model: '',
  tools: [],
  skills: '',
  middleware: '',
  memoryEnabled: false,
  runMode: 'interactive',
  maxRunDurationMinutes: 30,
  personalizationPrompt: '',
})

function formToRequest(f: FormState): AgentRequest {
  return {
    name:                    f.name,
    instructions:            f.instructions,
    provider:                f.provider,
    model:                   f.model,
    tools:                   f.tools,
    skills:                  f.skills.split(',').map(s => s.trim()).filter(Boolean),
    middleware:               f.middleware.split(',').map(s => s.trim()).filter(Boolean),
    memoryEnabled:           f.memoryEnabled,
    runMode:                 f.runMode,
    maxRunDurationMinutes:   f.maxRunDurationMinutes,
    personalizationPrompt:   f.personalizationPrompt || undefined,
  }
}

function agentToForm(a: AgentDto): FormState {
  return {
    name:                    a.name,
    instructions:            a.instructions ?? '',
    provider:                a.provider,
    model:                   a.model,
    tools:                   a.tools ?? [],
    skills:                  (a.skills ?? []).join(', '),
    middleware:               (a.middleware ?? []).join(', '),
    memoryEnabled:           a.memoryEnabled,
    runMode:                 a.runMode,
    maxRunDurationMinutes:   a.maxRunDurationMinutes,
    personalizationPrompt:   a.personalizationPrompt ?? '',
  }
}

// ── Tool icon helper ─────────────────────────────────────────────────────────

function toolIcon(type: Tool['type']) {
  if (type === 'function') return <Wrench size={11} className="text-orange-400" />
  if (type === 'mcp')      return <Server  size={11} className="text-purple-400" />
  return                          <Globe   size={11} className="text-blue-400"   />
}

// ── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, onEdit, onDelete }: {
  agent: AgentDto
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex items-start gap-4 p-4 bg-gray-800 border border-gray-700
                    rounded-xl hover:border-gray-600 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
        <Bot size={18} className="text-blue-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white truncate">{agent.name}</h3>
          <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-400 capitalize">
            {agent.runMode}
          </span>
          {agent.memoryEnabled && (
            <span className="text-xs px-1.5 py-0.5 bg-purple-900/50 rounded text-purple-400">
              memory
            </span>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-0.5">
          {agent.provider} / {agent.model}
        </p>

        {agent.instructions && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
            {agent.instructions}
          </p>
        )}

        {agent.tools?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {agent.tools.slice(0, 5).map((t, i) => (
              <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-900 rounded text-xs text-gray-400">
                {toolIcon(t.type)}
                {t.type === 'function' ? t.name : t.type === 'mcp' ? `${t.server}/${t.tool}` : t.name ?? t.spec_url}
              </span>
            ))}
            {agent.tools.length > 5 && (
              <span className="px-1.5 py-0.5 text-xs text-gray-600">+{agent.tools.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Section label ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-400 mb-1.5">{children}</label>
}

const inputCls = 'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500'
const textareaCls = `${inputCls} resize-none`

// ── Main page ────────────────────────────────────────────────────────────────

export function Agents() {
  const qc = useQueryClient()

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
  })

  const createMut = useMutation({
    mutationFn: agentsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }); closeDrawer() },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, req }: { id: string; req: AgentRequest }) => agentsApi.update(id, req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agents'] }); closeDrawer() },
  })

  const deleteMut = useMutation({
    mutationFn: agentsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })

  // Drawer state
  const [drawerMode, setDrawerMode]   = useState<DrawerMode | null>(null)
  const [editTarget, setEditTarget]   = useState<AgentDto | null>(null)
  const [form, setForm]               = useState<FormState>(defaultForm())
  const [activeTab, setActiveTab]     = useState<'config' | 'test'>('config')
  const [search, setSearch]           = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  function openCreate() {
    setForm(defaultForm())
    setEditTarget(null)
    setDrawerMode('create')
    setActiveTab('config')
  }

  function openEdit(agent: AgentDto) {
    setForm(agentToForm(agent))
    setEditTarget(agent)
    setDrawerMode('edit')
    setActiveTab('config')
  }

  function closeDrawer() {
    setDrawerMode(null)
    setEditTarget(null)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function submit() {
    const req = formToRequest(form)
    if (drawerMode === 'create') {
      createMut.mutate(req)
    } else if (editTarget) {
      updateMut.mutate({ id: editTarget.id, req })
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.provider.toLowerCase().includes(search.toLowerCase()),
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-0 relative overflow-hidden">

      {/* Main list */}
      <div className={clsx(
        'flex-1 flex flex-col min-w-0 transition-all duration-300',
        drawerMode ? 'lg:mr-[560px]' : '',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Agents</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                       text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Agent
          </button>
        </div>

        {/* Search */}
        <input
          className={`${inputCls} mb-4`}
          placeholder="Search agents…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* List */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bot size={40} className="text-gray-700 mb-3" />
            <p className="text-gray-400 font-medium">
              {search ? 'No agents match your search' : 'No agents yet'}
            </p>
            {!search && (
              <p className="text-gray-600 text-sm mt-1">
                Create your first agent to get started
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => openEdit(agent)}
              onDelete={() => setDeleteConfirm(agent.id)}
            />
          ))}
        </div>
      </div>

      {/* Slide-in drawer */}
      {drawerMode && (
        <div className="fixed right-0 top-0 bottom-0 w-[560px] bg-gray-900 border-l border-gray-700
                        flex flex-col shadow-2xl z-40 overflow-hidden">

          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">
              {drawerMode === 'create' ? 'New Agent' : `Edit: ${editTarget?.name}`}
            </h3>
            <button onClick={closeDrawer} className="text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Tabs (only in edit mode) */}
          {drawerMode === 'edit' && editTarget && (
            <div className="flex border-b border-gray-800 px-5">
              {(['config', 'test'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    'py-3 px-4 text-xs font-medium capitalize border-b-2 -mb-px transition-colors',
                    activeTab === tab
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-300',
                  )}
                >
                  {tab === 'config' ? 'Configuration' : 'Test'}
                </button>
              ))}
            </div>
          )}

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Config tab ── */}
            {activeTab === 'config' && (
              <div className="p-5 space-y-5">

                {/* Name */}
                <div>
                  <Label>Agent Name *</Label>
                  <input
                    className={inputCls}
                    placeholder="e.g. Research Assistant"
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                  />
                </div>

                {/* Provider + Model */}
                <div>
                  <Label>Provider & Model *</Label>
                  <ProviderModelPicker
                    provider={form.provider}
                    model={form.model}
                    onProviderChange={p => setField('provider', p)}
                    onModelChange={m => setField('model', m)}
                  />
                </div>

                {/* Instructions */}
                <div>
                  <Label>System Instructions</Label>
                  <textarea
                    className={textareaCls}
                    rows={4}
                    placeholder="You are a helpful assistant that…"
                    value={form.instructions}
                    onChange={e => setField('instructions', e.target.value)}
                  />
                </div>

                {/* Tools */}
                <div>
                  <Label>Tools</Label>
                  <ToolsEditor
                    tools={form.tools}
                    onChange={tools => setField('tools', tools)}
                  />
                </div>

                {/* Skills */}
                <div>
                  <Label>Skills (comma-separated)</Label>
                  <input
                    className={inputCls}
                    placeholder="e.g. summarize, translate, code_review"
                    value={form.skills}
                    onChange={e => setField('skills', e.target.value)}
                  />
                </div>

                {/* Middleware */}
                <div>
                  <Label>Middleware (comma-separated)</Label>
                  <input
                    className={inputCls}
                    placeholder="e.g. rate_limiter, safety_filter"
                    value={form.middleware}
                    onChange={e => setField('middleware', e.target.value)}
                  />
                </div>

                {/* Memory + Run mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Run Mode</Label>
                    <select
                      value={form.runMode}
                      onChange={e => setField('runMode', e.target.value as FormState['runMode'])}
                      className={inputCls}
                    >
                      <option value="interactive">Interactive</option>
                      <option value="background">Background</option>
                    </select>
                  </div>
                  <div>
                    <Label>Max Duration (min)</Label>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      className={inputCls}
                      value={form.maxRunDurationMinutes}
                      onChange={e => setField('maxRunDurationMinutes', Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Memory toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setField('memoryEnabled', !form.memoryEnabled)}
                    className={clsx(
                      'w-9 h-5 rounded-full transition-colors relative flex-shrink-0',
                      form.memoryEnabled ? 'bg-blue-600' : 'bg-gray-700',
                    )}
                  >
                    <div className={clsx(
                      'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                      form.memoryEnabled ? 'translate-x-4' : 'translate-x-0.5',
                    )} />
                  </div>
                  <span className="text-sm text-gray-300">Enable cross-session memory</span>
                </label>

                {/* Personalization */}
                <div>
                  <Label>Personalization Prompt</Label>
                  <textarea
                    className={textareaCls}
                    rows={2}
                    placeholder="Additional context about the user or their preferences…"
                    value={form.personalizationPrompt}
                    onChange={e => setField('personalizationPrompt', e.target.value)}
                  />
                </div>

                {/* Error */}
                {(createMut.error || updateMut.error) && (
                  <p className="text-xs text-red-400">
                    {(createMut.error as Error)?.message || (updateMut.error as Error)?.message}
                  </p>
                )}
              </div>
            )}

            {/* ── Test tab ── */}
            {activeTab === 'test' && editTarget && (
              <div className="p-5 flex flex-col" style={{ height: 'calc(100% - 0px)' }}>
                <AgentTestPanel agentId={editTarget.id} />
              </div>
            )}
          </div>

          {/* Drawer footer — only on config tab */}
          {activeTab === 'config' && (
            <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
              <button
                onClick={submit}
                disabled={isSaving || !form.name || !form.provider || !form.model}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                           disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium
                           transition-colors"
              >
                {isSaving ? 'Saving…' : drawerMode === 'create' ? 'Create Agent' : 'Save Changes'}
              </button>
              <button
                onClick={closeDrawer}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-80 shadow-2xl">
            <h4 className="text-sm font-semibold text-white mb-2">Delete Agent?</h4>
            <p className="text-xs text-gray-400 mb-5">
              This action cannot be undone. Any sessions using this agent will switch to the default.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  deleteMut.mutate(deleteConfirm)
                  setDeleteConfirm(null)
                  if (editTarget?.id === deleteConfirm) closeDrawer()
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

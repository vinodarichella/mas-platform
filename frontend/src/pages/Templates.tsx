import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactFlow, { Background, MiniMap, ReactFlowProvider } from 'reactflow'
import 'reactflow/dist/style.css'
import {
  LayoutTemplate, Search, GitBranch, Plus, X, Loader2,
  CheckCircle2, Code2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { templatesApi, type TemplateDto } from '@/api/templates'
import { workflowsApi } from '@/api/workflows'
import { AgentNode }       from '@/components/workflow/nodes/AgentNode'
import { StartNode }       from '@/components/workflow/nodes/StartNode'
import { EndNode }         from '@/components/workflow/nodes/EndNode'
import { ConditionNode }   from '@/components/workflow/nodes/ConditionNode'
import { ParallelForkNode, ParallelJoinNode } from '@/components/workflow/nodes/ParallelNode'
import { HITLNode }        from '@/components/workflow/nodes/HITLNode'
import type { Node, Edge } from 'reactflow'

const NODE_TYPES = {
  agent:        AgentNode,
  start:        StartNode,
  end:          EndNode,
  condition:    ConditionNode,
  parallelFork: ParallelForkNode,
  parallelJoin: ParallelJoinNode,
  hitl:         HITLNode,
}

const CATEGORIES = ['All', 'support', 'research', 'marketing', 'other']

const ORCH_COLORS: Record<string, string> = {
  sequential:  'bg-blue-900/30 text-blue-300 border-blue-800',
  concurrent:  'bg-purple-900/30 text-purple-300 border-purple-800',
  handoff:     'bg-amber-900/30 text-amber-300 border-amber-800',
  groupchat:   'bg-green-900/30 text-green-300 border-green-800',
  magentic:    'bg-pink-900/30 text-pink-300 border-pink-800',
  declarative: 'bg-cyan-900/30 text-cyan-300 border-cyan-800',
}

// ── Mini graph preview ────────────────────────────────────────────────────────

function GraphPreview({ graphJson }: { graphJson: TemplateDto['graphJson'] }) {
  const nodes = (graphJson?.nodes ?? []) as Node[]
  const edges = (graphJson?.edges ?? []) as Edge[]

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
        className="bg-gray-950 rounded-lg"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1f2937" gap={16} size={1} />
        <MiniMap
          nodeColor={n => {
            if (n.type === 'start')     return '#16a34a'
            if (n.type === 'end')       return '#dc2626'
            if (n.type === 'agent')     return '#2563eb'
            if (n.type === 'condition') return '#d97706'
            if (n.type === 'hitl')      return '#db2777'
            return '#6b7280'
          }}
          className="!bg-gray-800 !border-gray-700 !bottom-2 !right-2"
          style={{ width: 80, height: 50 }}
        />
      </ReactFlow>
    </ReactFlowProvider>
  )
}

// ── Use template modal ────────────────────────────────────────────────────────

function UseTemplateModal({
  template,
  onClose,
}: {
  template: TemplateDto
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(template.name)
  const [created, setCreated] = useState(false)

  const createMut = useMutation({
    mutationFn: () =>
      workflowsApi.create({
        name,
        orchestrationType: template.orchestrationType,
        description: template.description ?? undefined,
        graphJson: template.graphJson as never,
        yamlContent: template.yamlContent ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      setCreated(true)
    },
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <p className="text-sm font-semibold text-white">Use Template</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Workflow name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg
                         text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="e.g. My Research Pipeline"
            />
          </div>

          <div className="p-3 bg-gray-800 rounded-lg text-xs text-gray-400 space-y-1">
            <p><span className="text-gray-500">Template:</span> {template.name}</p>
            <p><span className="text-gray-500">Type:</span> {template.orchestrationType}</p>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          {created ? (
            <div className="flex-1 flex items-center justify-center gap-2 py-2.5
                            bg-green-900/30 border border-green-800 rounded-xl text-green-400 text-sm">
              <CheckCircle2 size={14} />
              Workflow created — go to Workflows to edit it
            </div>
          ) : (
            <>
              <button
                disabled={!name.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5
                           bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                           text-white rounded-xl text-sm font-medium transition-colors"
              >
                {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {createMut.isPending ? 'Creating…' : 'Create Workflow'}
              </button>
              <button
                onClick={onClose}
                className="px-4 text-gray-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Template detail panel ─────────────────────────────────────────────────────

function TemplateDetail({
  template,
  onClose,
  onUse,
}: {
  template: TemplateDto
  onClose: () => void
  onUse: () => void
}) {
  const [tab, setTab] = useState<'graph' | 'yaml'>('graph')

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-40 p-0 sm:p-4">
      <div className="w-full sm:max-w-3xl h-[85vh] sm:h-[75vh] bg-gray-900 border border-gray-700
                      rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-base font-semibold text-white">{template.name}</h3>
            {template.description && (
              <p className="text-sm text-gray-400 mt-0.5">{template.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={clsx(
                'text-xs px-2 py-0.5 rounded border capitalize',
                ORCH_COLORS[template.orchestrationType] ?? 'bg-gray-800 text-gray-400 border-gray-700',
              )}>
                {template.orchestrationType}
              </span>
              {template.category && (
                <span className="text-xs text-gray-500">{template.category}</span>
              )}
              {template.isBuiltin && (
                <span className="text-xs text-amber-600">Built-in</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onUse}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700
                         text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Plus size={12} /> Use Template
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-800 flex-shrink-0">
          {(['graph', 'yaml'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium border-b-2 transition-colors',
                tab === t
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300',
              )}
            >
              {t === 'graph' ? <GitBranch size={11} /> : <Code2 size={11} />}
              {t === 'graph' ? 'Graph' : 'YAML'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {tab === 'graph' ? (
            <GraphPreview graphJson={template.graphJson} />
          ) : (
            <pre className="h-full overflow-auto p-5 text-xs text-green-300 font-mono leading-relaxed whitespace-pre">
              {template.yamlContent ?? '# No YAML content'}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onClick }: { template: TemplateDto; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group text-left p-4 bg-gray-800 border border-gray-700 rounded-xl
                 hover:border-blue-600 hover:bg-gray-750 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
          {template.name}
        </h3>
        {template.isBuiltin && (
          <span className="text-xs text-amber-600 ml-2 flex-shrink-0">Built-in</span>
        )}
      </div>

      <span className={clsx(
        'inline-block text-xs px-2 py-0.5 rounded border capitalize mb-2',
        ORCH_COLORS[template.orchestrationType] ?? 'bg-gray-800 text-gray-400 border-gray-700',
      )}>
        {template.orchestrationType}
      </span>

      {template.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{template.description}</p>
      )}

      <p className="text-xs text-gray-700 mt-2">
        {(template.graphJson?.nodes?.length ?? 0)} nodes
      </p>
    </button>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function Templates() {
  const [category,  setCategory]  = useState('All')
  const [search,    setSearch]    = useState('')
  const [preview,   setPreview]   = useState<TemplateDto | null>(null)
  const [useModal,  setUseModal]  = useState<TemplateDto | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', category],
    queryFn: () => templatesApi.list(category === 'All' ? undefined : category),
  })

  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutTemplate size={20} className="text-blue-400" />
          <div>
            <h2 className="text-xl font-semibold text-white">Templates</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Browse pre-built workflow templates
            </p>
          </div>
        </div>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg
                       text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                category === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-gray-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LayoutTemplate size={40} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">No templates found</p>
          <p className="text-gray-600 text-sm mt-1">
            {search ? 'Try a different search term' : 'No templates in this category yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onClick={() => setPreview(t)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {preview && (
        <TemplateDetail
          template={preview}
          onClose={() => setPreview(null)}
          onUse={() => { setUseModal(preview); setPreview(null) }}
        />
      )}

      {/* Use template modal */}
      {useModal && (
        <UseTemplateModal
          template={useModal}
          onClose={() => setUseModal(null)}
        />
      )}
    </div>
  )
}

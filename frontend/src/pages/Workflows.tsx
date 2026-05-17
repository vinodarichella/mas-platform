import {
  useState, useCallback, useRef, type DragEvent,
} from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection,
  type NodeChange, type EdgeChange,
  ReactFlowProvider, useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Save, ArrowLeft, Trash2, Eye, EyeOff,
  GitBranch, ChevronDown, BookMarked, Upload, X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { workflowsApi, type WorkflowDto } from '@/api/workflows'
import { templatesApi } from '@/api/templates'
import { NodePalette }     from '@/components/workflow/NodePalette'
import { PropertiesPanel } from '@/components/workflow/PropertiesPanel'
import { graphToYaml }     from '@/components/workflow/graphToYaml'
import { yamlToGraph }     from '@/components/workflow/yamlToGraph'
import { AgentNode }       from '@/components/workflow/nodes/AgentNode'
import { StartNode }       from '@/components/workflow/nodes/StartNode'
import { EndNode }         from '@/components/workflow/nodes/EndNode'
import { ConditionNode }   from '@/components/workflow/nodes/ConditionNode'
import { ParallelForkNode, ParallelJoinNode } from '@/components/workflow/nodes/ParallelNode'
import { HITLNode }        from '@/components/workflow/nodes/HITLNode'

// ── ReactFlow node type registry ─────────────────────────────────────────────

const NODE_TYPES = {
  agent:        AgentNode,
  start:        StartNode,
  end:          EndNode,
  condition:    ConditionNode,
  parallelFork: ParallelForkNode,
  parallelJoin: ParallelJoinNode,
  hitl:         HITLNode,
}

// ── Orchestration types ───────────────────────────────────────────────────────

const ORCH_TYPES = [
  { value: 'sequential',  label: 'Sequential',  desc: 'Agents run one after another' },
  { value: 'concurrent',  label: 'Concurrent',  desc: 'All agents run in parallel'   },
  { value: 'handoff',     label: 'Handoff',     desc: 'Agent-to-agent handoff chain' },
  { value: 'groupchat',   label: 'Group Chat',  desc: 'Collaborative multi-agent chat' },
  { value: 'magentic',    label: 'Magentic',    desc: 'Orchestrator + team pattern'  },
  { value: 'declarative', label: 'Declarative', desc: 'Full graph with conditions'   },
]

// ── Workflow list ─────────────────────────────────────────────────────────────

function WorkflowList({
  workflows,
  onSelect,
  onCreate,
  onDelete,
  isDeleting,
}: {
  workflows: WorkflowDto[]
  onSelect: (w: WorkflowDto) => void
  onCreate: () => void
  onDelete: (id: string) => void
  isDeleting: boolean
}) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Workflows</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
                     text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Workflow
        </button>
      </div>

      {workflows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GitBranch size={40} className="text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">No workflows yet</p>
          <p className="text-gray-600 text-sm mt-1">Create a workflow to get started</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workflows.map(w => (
          <div
            key={w.id}
            onClick={() => onSelect(w)}
            className="group relative p-4 bg-gray-800 border border-gray-700 rounded-xl
                       hover:border-blue-600 hover:bg-gray-750 cursor-pointer transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-medium text-white truncate pr-8">{w.name}</h3>
              <button
                onClick={e => { e.stopPropagation(); setDeleteConfirm(w.id) }}
                className="absolute top-3 right-3 p-1 text-gray-600 hover:text-red-400
                           opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <span className="inline-block text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400 capitalize mb-2">
              {w.orchestrationType}
            </span>

            {w.description && (
              <p className="text-xs text-gray-500 line-clamp-2">{w.description}</p>
            )}

            <p className="text-xs text-gray-700 mt-2">
              {new Date(w.updatedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-80 shadow-2xl">
            <h4 className="text-sm font-semibold text-white mb-2">Delete Workflow?</h4>
            <p className="text-xs text-gray-400 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                disabled={isDeleting}
                onClick={() => { onDelete(deleteConfirm); setDeleteConfirm(null) }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 text-gray-400 hover:text-white text-sm"
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

// ── Create workflow modal ─────────────────────────────────────────────────────

function CreateModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: (name: string, type: string) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName]   = useState('')
  const [type, setType]   = useState('sequential')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl">
        <h4 className="text-sm font-semibold text-white mb-4">New Workflow</h4>

        <label className="block text-xs text-gray-400 mb-1.5">Name</label>
        <input
          autoFocus
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg
                     text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 mb-3"
          placeholder="e.g. Research Pipeline"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim(), type)}
        />

        <label className="block text-xs text-gray-400 mb-1.5">Orchestration Type</label>
        <select
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg
                     text-sm text-white focus:outline-none focus:border-blue-500 mb-1"
          value={type}
          onChange={e => setType(e.target.value)}
        >
          {ORCH_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-xs text-gray-600 mb-5">
          {ORCH_TYPES.find(o => o.value === type)?.desc}
        </p>

        <div className="flex gap-3">
          <button
            disabled={!name.trim() || isPending}
            onClick={() => onConfirm(name.trim(), type)}
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

// ── Canvas (inner) ────────────────────────────────────────────────────────────

let nodeCounter = 1

function CanvasInner({
  workflow,
  onBack,
  onSaved,
}: {
  workflow: WorkflowDto
  onBack: () => void
  onSaved: () => void
}) {
  const qc          = useQueryClient()
  const { project } = useReactFlow()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const initialGraph = workflow.graphJson ?? { nodes: [], edges: [] }
  const [nodes,       setNodes]       = useState<Node[]>(initialGraph.nodes as Node[])
  const [edges,       setEdges]       = useState<Edge[]>(initialGraph.edges as Edge[])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [orchType,    setOrchType]    = useState(workflow.orchestrationType)
  const [workflowName, setWorkflowName] = useState(workflow.name)
  const [showYaml,    setShowYaml]    = useState(false)
  const [showOrchMenu, setShowOrchMenu] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showYamlImport,   setShowYamlImport]   = useState(false)

  const saveMut = useMutation({
    mutationFn: () => {
      const yaml = graphToYaml(workflowName, orchType, nodes, edges)
      return workflowsApi.update(workflow.id, {
        name: workflowName,
        orchestrationType: orchType,
        graphJson: { nodes, edges } as never,
        yamlContent: yaml,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); onSaved() },
  })

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(n => applyNodeChanges(changes, n)),
    [],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges(e => applyEdgeChanges(changes, e)),
    [],
  )
  const onConnect = useCallback(
    (connection: Connection) => setEdges(e => addEdge({ ...connection, animated: true }, e)),
    [],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => setSelectedNode(null), [])

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const type    = event.dataTransfer.getData('application/reactflow-type')
    const dataRaw = event.dataTransfer.getData('application/reactflow-data')
    if (!type) return

    const bounds = reactFlowWrapper.current?.getBoundingClientRect()
    if (!bounds) return

    const position = project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })

    const data = dataRaw ? JSON.parse(dataRaw) : {}
    const newNode: Node = {
      id:   `${type}_${nodeCounter++}`,
      type,
      position,
      data,
    }
    setNodes(ns => [...ns, newNode])
  }, [project])

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const liveYaml = showYaml ? graphToYaml(workflowName, orchType, nodes, edges) : ''

  return (
    <div className="flex flex-col h-full">
      {/* Save as Template modal */}
      {showSaveTemplate && (
        <SaveAsTemplateModal
          workflowId={workflow.id}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}

      {/* YAML Import modal */}
      {showYamlImport && (
        <YamlImportModal
          onClose={() => setShowYamlImport(false)}
          onImport={(importedNodes, importedEdges, importedOrchType) => {
            setNodes(importedNodes)
            setEdges(importedEdges)
            setOrchType(importedOrchType)
            setShowYamlImport(false)
          }}
        />
      )}

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
        >
          <ArrowLeft size={16} />
        </button>

        <input
          className="flex-1 max-w-xs bg-transparent text-sm font-medium text-white
                     border-b border-transparent hover:border-gray-600 focus:border-blue-500
                     focus:outline-none py-0.5 px-1 transition-colors"
          value={workflowName}
          onChange={e => setWorkflowName(e.target.value)}
        />

        {/* Orchestration type picker */}
        <div className="relative">
          <button
            onClick={() => setShowOrchMenu(m => !m)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700
                       rounded-lg text-xs text-gray-300 hover:border-gray-600 transition-colors"
          >
            <GitBranch size={12} />
            {ORCH_TYPES.find(o => o.value === orchType)?.label ?? orchType}
            <ChevronDown size={11} className={clsx('transition-transform', showOrchMenu && 'rotate-180')} />
          </button>
          {showOrchMenu && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-gray-800 border border-gray-700
                            rounded-lg shadow-xl z-20 overflow-hidden">
              {ORCH_TYPES.map(o => (
                <button
                  key={o.value}
                  onClick={() => { setOrchType(o.value); setShowOrchMenu(false) }}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors',
                    orchType === o.value ? 'text-blue-400 bg-gray-700' : 'text-gray-300',
                  )}
                >
                  <span className="font-medium">{o.label}</span>
                  <span className="text-gray-500 ml-2">{o.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowYamlImport(true)}
            title="Import from YAML"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border
                       border-gray-700 text-gray-400 hover:border-gray-600 transition-colors"
          >
            <Upload size={12} />
            Import
          </button>

          <button
            onClick={() => setShowSaveTemplate(true)}
            title="Save as template"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border
                       border-gray-700 text-gray-400 hover:border-gray-600 transition-colors"
          >
            <BookMarked size={12} />
            Template
          </button>

          <button
            onClick={() => setShowYaml(v => !v)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors',
              showYaml
                ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                : 'border-gray-700 text-gray-400 hover:border-gray-600',
            )}
          >
            {showYaml ? <EyeOff size={12} /> : <Eye size={12} />}
            YAML
          </button>

          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Save size={12} />
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Body: palette + canvas + panels */}
      <div className="flex flex-1 min-h-0">
        <NodePalette />

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="flex-1 min-w-0"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            deleteKeyCode="Delete"
            className="bg-gray-950"
          >
            <Background color="#374151" gap={20} size={1} />
            <Controls className="!bg-gray-800 !border-gray-700 [&>button]:!bg-gray-800 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700 [&>button]:!border-gray-700" />
            <MiniMap
              nodeColor={n => {
                if (n.type === 'start')       return '#16a34a'
                if (n.type === 'end')         return '#dc2626'
                if (n.type === 'agent')       return '#2563eb'
                if (n.type === 'condition')   return '#d97706'
                if (n.type === 'hitl')        return '#db2777'
                return '#6b7280'
              }}
              className="!bg-gray-900 !border-gray-700"
            />
          </ReactFlow>
        </div>

        {/* Properties panel */}
        {selectedNode && !showYaml && (
          <PropertiesPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* YAML preview */}
        {showYaml && (
          <div className="w-80 flex-shrink-0 flex flex-col bg-gray-900 border-l border-gray-800">
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-xs font-semibold text-gray-400">Generated YAML</p>
              <p className="text-xs text-gray-600 mt-0.5">Live preview — saved on click Save</p>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs text-green-300 font-mono leading-relaxed whitespace-pre">
              {liveYaml || '# Add nodes to see YAML…'}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Save as Template modal ────────────────────────────────────────────────────

function SaveAsTemplateModal({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [category, setCategory] = useState('')
  const [done,     setDone]     = useState(false)

  const mut = useMutation({
    mutationFn: () => templatesApi.saveAsTemplate(workflowId, {
      name:        name.trim() || undefined,
      description: desc.trim() || undefined,
      category:    category.trim() || undefined,
    }),
    onSuccess: () => setDone(true),
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <BookMarked size={14} className="text-blue-400" />
            <p className="text-sm font-semibold text-white">Save as Template</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {done ? (
            <p className="text-sm text-green-400 py-3 text-center">
              Template saved — browse it in the Templates page.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Defaults to workflow name"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
                <input value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="Describe what this template does"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Category (optional)</label>
                <input value={category} onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. support, research, marketing"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => mut.mutate()}
                  disabled={mut.isPending}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {mut.isPending ? 'Saving…' : 'Save Template'}
                </button>
                <button onClick={onClose} className="px-4 text-gray-400 hover:text-white text-sm">Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── YAML Import modal ─────────────────────────────────────────────────────────

function YamlImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (nodes: Node[], edges: Edge[], orchType: string) => void
}) {
  const [yaml,  setYaml]  = useState('')
  const [error, setError] = useState('')

  function doImport() {
    setError('')
    try {
      const { nodes, edges } = yamlToGraph(yaml)
      const orchMatch = yaml.match(/orchestration_type:\s*(\S+)/)
      const orchType  = orchMatch?.[1] ?? 'sequential'
      if (nodes.length === 0) { setError('No nodes parsed — check your YAML format.'); return }
      onImport(nodes, edges, orchType)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse error')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Upload size={14} className="text-blue-400" />
            <p className="text-sm font-semibold text-white">Import from YAML</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="px-6 py-4 flex-1 min-h-0 flex flex-col gap-3">
          <p className="text-xs text-gray-500">Paste MAF workflow YAML. The canvas will be replaced.</p>
          <textarea
            autoFocus
            value={yaml}
            onChange={e => setYaml(e.target.value)}
            placeholder={`orchestration_type: sequential\nname: My Workflow\n\nagents:\n- alias: step1\n  ref: ""\n  instructions: "Do something"`}
            className="flex-1 min-h-48 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                       text-xs text-green-300 font-mono placeholder-gray-600 resize-none
                       focus:outline-none focus:border-blue-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              disabled={!yaml.trim()}
              onClick={doImport}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Import
            </button>
            <button onClick={onClose} className="px-4 text-gray-400 hover:text-white text-sm">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Canvas with ReactFlowProvider wrapper ─────────────────────────────────────

function Canvas(props: Parameters<typeof CanvasInner>[0]) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}

// ── Root page component ───────────────────────────────────────────────────────

export function Workflows() {
  const qc = useQueryClient()

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowsApi.list,
  })

  const createMut = useMutation({
    mutationFn: (req: { name: string; orchestrationType: string }) =>
      workflowsApi.create({ ...req, graphJson: { nodes: [], edges: [] } as never }),
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      setCreating(false)
      setActiveWorkflow(w)
    },
  })

  const deleteMut = useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  })

  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowDto | null>(null)
  const [creating,       setCreating]       = useState(false)

  // ── Canvas view ─────────────────────────────────────────────────────────────
  if (activeWorkflow) {
    return (
      <div className="h-full -m-6">
        <Canvas
          workflow={activeWorkflow}
          onBack={() => setActiveWorkflow(null)}
          onSaved={() => setActiveWorkflow(null)}
        />
      </div>
    )
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <WorkflowList
          workflows={workflows}
          onSelect={setActiveWorkflow}
          onCreate={() => setCreating(true)}
          onDelete={deleteMut.mutate}
          isDeleting={deleteMut.isPending}
        />
      )}

      {creating && (
        <CreateModal
          isPending={createMut.isPending}
          onConfirm={(name, type) => createMut.mutate({ name, orchestrationType: type })}
          onCancel={() => setCreating(false)}
        />
      )}
    </>
  )
}

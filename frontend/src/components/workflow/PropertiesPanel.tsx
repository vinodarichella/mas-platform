import { type Node, useReactFlow } from 'reactflow'
import { useQuery } from '@tanstack/react-query'
import { agentsApi } from '@/api/agents'
import { X } from 'lucide-react'

interface Props {
  node: Node
  onClose: () => void
}

const inputCls = 'w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500'
const labelCls = 'block text-xs font-medium text-gray-400 mb-1.5'

export function PropertiesPanel({ node, onClose }: Props) {
  const { setNodes } = useReactFlow()

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: agentsApi.list,
    staleTime: 30_000,
  })

  function update(patch: Record<string, unknown>) {
    setNodes(nds => nds.map(n =>
      n.id === node.id ? { ...n, data: { ...n.data, ...patch } } : n,
    ))
  }

  const d = node.data as Record<string, unknown>

  return (
    <div className="w-64 flex-shrink-0 flex flex-col bg-gray-900 border-l border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold text-gray-300 capitalize">{node.type} Properties</p>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Agent node ── */}
        {node.type === 'agent' && (
          <>
            <div>
              <label className={labelCls}>Agent</label>
              <select
                className={inputCls}
                value={(d.agentId as string) ?? ''}
                onChange={e => {
                  const agent = agents.find(a => a.id === e.target.value)
                  update({
                    agentId:   e.target.value,
                    agentName: agent?.name ?? '',
                    provider:  agent?.provider ?? '',
                    model:     agent?.model ?? '',
                  })
                }}
              >
                <option value="">Select agent…</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.provider}/{a.model})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Alias (step name)</label>
              <input
                className={inputCls}
                placeholder="e.g. researcher"
                value={(d.alias as string) ?? ''}
                onChange={e => update({ alias: e.target.value })}
              />
            </div>

            <div>
              <label className={labelCls}>Override Instructions</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={4}
                placeholder="Leave blank to use agent's default…"
                value={(d.instructions as string) ?? ''}
                onChange={e => update({ instructions: e.target.value })}
              />
            </div>
          </>
        )}

        {/* ── Condition node ── */}
        {node.type === 'condition' && (
          <div>
            <label className={labelCls}>Expression</label>
            <input
              className={inputCls}
              placeholder="e.g. result.confidence > 0.8"
              value={(d.expression as string) ?? ''}
              onChange={e => update({ expression: e.target.value })}
            />
            <p className="text-xs text-gray-600 mt-1.5">
              Right handle (top) = true, (bottom) = false
            </p>
          </div>
        )}

        {/* ── HITL node ── */}
        {node.type === 'hitl' && (
          <>
            <div>
              <label className={labelCls}>Prompt for reviewer</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                placeholder="What should the human reviewer do?"
                value={(d.prompt as string) ?? ''}
                onChange={e => update({ prompt: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Timeout (minutes)</label>
              <input
                type="number"
                className={inputCls}
                min={1}
                max={1440}
                value={(d.timeout as number) ?? 60}
                onChange={e => update({ timeout: Number(e.target.value) })}
              />
            </div>
          </>
        )}

        {/* ── Start / End / Fork / Join ── */}
        {['start', 'end', 'parallelFork', 'parallelJoin'].includes(node.type ?? '') && (
          <p className="text-xs text-gray-600 italic">
            No configurable properties for this node type.
          </p>
        )}
      </div>

      {/* Node ID footer */}
      <div className="px-4 py-2 border-t border-gray-800">
        <p className="text-[10px] text-gray-700 font-mono truncate">id: {node.id}</p>
      </div>
    </div>
  )
}

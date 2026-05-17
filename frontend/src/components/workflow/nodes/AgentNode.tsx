import { Handle, Position, type NodeProps } from 'reactflow'
import { Bot } from 'lucide-react'
import { clsx } from 'clsx'

export interface AgentNodeData {
  agentId?: string
  agentName?: string
  alias?: string
  instructions?: string
  provider?: string
  model?: string
}

export function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  return (
    <div className={clsx(
      'w-52 rounded-xl border bg-gray-800 shadow-xl transition-all',
      selected ? 'border-blue-500 shadow-blue-900/40' : 'border-gray-700',
    )}>
      <Handle type="target" position={Position.Left}  className="!bg-blue-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3" />

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-md bg-blue-600/30 flex items-center justify-center flex-shrink-0">
            <Bot size={13} className="text-blue-400" />
          </div>
          <span className="text-sm font-medium text-white truncate">
            {data.agentName || 'Agent'}
          </span>
        </div>

        {data.alias && (
          <p className="text-xs text-blue-400 font-mono mb-1">alias: {data.alias}</p>
        )}

        {(data.provider || data.model) && (
          <p className="text-xs text-gray-500 truncate">
            {data.provider} / {data.model}
          </p>
        )}

        {data.instructions && (
          <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
            {data.instructions}
          </p>
        )}

        {!data.agentId && (
          <p className="text-xs text-yellow-500 mt-1">⚠ No agent selected</p>
        )}
      </div>
    </div>
  )
}

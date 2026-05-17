import { Handle, Position, type NodeProps } from 'reactflow'
import { UserCheck } from 'lucide-react'
import { clsx } from 'clsx'

export interface HITLNodeData {
  prompt?: string
  timeout?: number
}

export function HITLNode({ data, selected }: NodeProps<HITLNodeData>) {
  return (
    <div className={clsx(
      'w-48 rounded-xl border bg-gray-800 shadow-xl',
      selected ? 'border-pink-500' : 'border-pink-800',
    )}>
      <Handle type="target" position={Position.Left}  className="!bg-pink-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-pink-500 !w-3 !h-3" />

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-pink-600/30 flex items-center justify-center">
            <UserCheck size={13} className="text-pink-400" />
          </div>
          <span className="text-sm font-medium text-pink-300">Human Review</span>
        </div>
        {data.prompt && (
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{data.prompt}</p>
        )}
        {data.timeout && (
          <p className="text-xs text-gray-600 mt-1">Timeout: {data.timeout}m</p>
        )}
      </div>
    </div>
  )
}

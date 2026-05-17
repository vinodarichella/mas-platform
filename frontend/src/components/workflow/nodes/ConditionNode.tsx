import { Handle, Position, type NodeProps } from 'reactflow'
import { GitBranch } from 'lucide-react'
import { clsx } from 'clsx'

export interface ConditionNodeData {
  expression?: string
}

export function ConditionNode({ data, selected }: NodeProps<ConditionNodeData>) {
  return (
    <div className="relative flex items-center justify-center w-44 h-20">
      <Handle type="target" position={Position.Left}  id="in"    className="!bg-yellow-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="true"  style={{ top: '30%' }} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="false" style={{ top: '70%' }} className="!bg-red-500 !w-3 !h-3" />

      {/* Diamond shape via CSS rotate */}
      <div className={clsx(
        'absolute inset-2 rounded-lg rotate-45 border-2 bg-yellow-900/30 transition-colors',
        selected ? 'border-yellow-400' : 'border-yellow-600',
      )} />

      <div className="relative z-10 flex flex-col items-center gap-1 px-2">
        <GitBranch size={14} className="text-yellow-400" />
        <span className="text-xs font-medium text-yellow-300">Condition</span>
        {data.expression && (
          <span className="text-xs text-yellow-500 font-mono truncate max-w-[120px]">
            {data.expression}
          </span>
        )}
      </div>

      {/* Handle labels */}
      <span className="absolute right-[-28px] top-[18%] text-[9px] text-green-400">true</span>
      <span className="absolute right-[-30px] top-[62%] text-[9px] text-red-400">false</span>
    </div>
  )
}

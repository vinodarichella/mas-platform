import { Handle, Position, type NodeProps } from 'reactflow'
import { GitMerge, Columns } from 'lucide-react'
import { clsx } from 'clsx'

export function ParallelForkNode({ selected }: NodeProps) {
  return (
    <div className={clsx(
      'flex flex-col items-center gap-1 px-4 py-2.5 rounded-lg border bg-gray-800',
      selected ? 'border-purple-400' : 'border-purple-700',
    )}>
      <Handle type="target" position={Position.Left}  className="!bg-purple-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="out0" style={{ top: '25%' }} className="!bg-purple-400 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="out1" style={{ top: '50%' }} className="!bg-purple-400 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="out2" style={{ top: '75%' }} className="!bg-purple-400 !w-3 !h-3" />
      <Columns size={16} className="text-purple-400" />
      <span className="text-xs font-medium text-purple-300">Fork</span>
    </div>
  )
}

export function ParallelJoinNode({ selected }: NodeProps) {
  return (
    <div className={clsx(
      'flex flex-col items-center gap-1 px-4 py-2.5 rounded-lg border bg-gray-800',
      selected ? 'border-purple-400' : 'border-purple-700',
    )}>
      <Handle type="target" position={Position.Left} id="in0" style={{ top: '25%' }} className="!bg-purple-400 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} id="in1" style={{ top: '50%' }} className="!bg-purple-400 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} id="in2" style={{ top: '75%' }} className="!bg-purple-400 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3" />
      <GitMerge size={16} className="text-purple-400" />
      <span className="text-xs font-medium text-purple-300">Join</span>
    </div>
  )
}

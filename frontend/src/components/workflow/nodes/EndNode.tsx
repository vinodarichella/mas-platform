import { Handle, Position } from 'reactflow'
import { Square } from 'lucide-react'

export function EndNode() {
  return (
    <div className="flex flex-col items-center gap-1">
      <Handle type="target" position={Position.Left} className="!bg-red-500 !w-3 !h-3" />
      <div className="w-12 h-12 rounded-full bg-red-700 flex items-center justify-center
                      shadow-lg shadow-red-900/50 border-2 border-red-500">
        <Square size={14} fill="white" className="text-white" />
      </div>
      <span className="text-xs text-red-400 font-medium">End</span>
    </div>
  )
}

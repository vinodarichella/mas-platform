import { Handle, Position } from 'reactflow'
import { Play } from 'lucide-react'

export function StartNode() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center
                      shadow-lg shadow-green-900/50 border-2 border-green-400">
        <Play size={16} fill="white" className="text-white ml-0.5" />
      </div>
      <span className="text-xs text-green-400 font-medium">Start</span>
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
    </div>
  )
}

import { type DragEvent } from 'react'
import { Play, Square, Bot, GitBranch, Columns, GitMerge, UserCheck } from 'lucide-react'

interface PaletteItem {
  type: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  defaultData: Record<string, unknown>
}

const ITEMS: PaletteItem[] = [
  {
    type: 'start',
    label: 'Start',
    description: 'Entry point',
    icon: Play,
    color: 'text-green-400 border-green-800 bg-green-950/40',
    defaultData: {},
  },
  {
    type: 'end',
    label: 'End',
    description: 'Exit point',
    icon: Square,
    color: 'text-red-400 border-red-800 bg-red-950/40',
    defaultData: {},
  },
  {
    type: 'agent',
    label: 'Agent',
    description: 'AI agent step',
    icon: Bot,
    color: 'text-blue-400 border-blue-800 bg-blue-950/40',
    defaultData: { agentName: 'Agent', alias: '' },
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch on expression',
    icon: GitBranch,
    color: 'text-yellow-400 border-yellow-800 bg-yellow-950/40',
    defaultData: { expression: '' },
  },
  {
    type: 'parallelFork',
    label: 'Fork',
    description: 'Split parallel branches',
    icon: Columns,
    color: 'text-purple-400 border-purple-800 bg-purple-950/40',
    defaultData: {},
  },
  {
    type: 'parallelJoin',
    label: 'Join',
    description: 'Merge parallel branches',
    icon: GitMerge,
    color: 'text-purple-400 border-purple-800 bg-purple-950/40',
    defaultData: {},
  },
  {
    type: 'hitl',
    label: 'Human Review',
    description: 'Pause for human input',
    icon: UserCheck,
    color: 'text-pink-400 border-pink-800 bg-pink-950/40',
    defaultData: { prompt: '', timeout: 60 },
  },
]

function onDragStart(e: DragEvent, item: PaletteItem) {
  e.dataTransfer.setData('application/reactflow-type', item.type)
  e.dataTransfer.setData('application/reactflow-data', JSON.stringify(item.defaultData))
  e.dataTransfer.effectAllowed = 'move'
}

export function NodePalette() {
  return (
    <div className="w-48 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-800">
      <div className="px-3 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nodes</p>
        <p className="text-xs text-gray-600 mt-0.5">Drag onto canvas</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
        {ITEMS.map(item => {
          const Icon = item.icon
          return (
            <div
              key={item.type}
              draggable
              onDragStart={e => onDragStart(e, item)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border
                          cursor-grab active:cursor-grabbing select-none
                          hover:brightness-125 transition-all ${item.color}`}
            >
              <Icon size={14} />
              <div>
                <p className="text-xs font-medium leading-none">{item.label}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{item.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

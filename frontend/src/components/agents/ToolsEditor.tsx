import { useState } from 'react'
import { Plus, Trash2, Wrench, Server, Globe } from 'lucide-react'
import type { Tool } from '@/api/agents'
import { clsx } from 'clsx'

interface Props {
  tools: Tool[]
  onChange: (tools: Tool[]) => void
}

type AddMode = 'function' | 'mcp' | 'openapi' | null

const BUILTIN_FUNCTIONS = ['web_search', 'calculator', 'datetime', 'file_reader']

export function ToolsEditor({ tools, onChange }: Props) {
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [draft, setDraft] = useState<Partial<Tool>>({})

  function removeTool(i: number) {
    onChange(tools.filter((_, idx) => idx !== i))
  }

  function commitTool() {
    if (!draft.type) return
    onChange([...tools, draft as Tool])
    setDraft({})
    setAddMode(null)
  }

  function cancel() {
    setDraft({})
    setAddMode(null)
  }

  return (
    <div className="space-y-3">
      {/* Existing tools */}
      {tools.map((tool, i) => (
        <ToolChip key={i} tool={tool} onRemove={() => removeTool(i)} />
      ))}

      {/* Add buttons */}
      {!addMode && (
        <div className="flex flex-wrap gap-2">
          <AddButton icon={Wrench} label="Function Tool" onClick={() => { setAddMode('function'); setDraft({ type: 'function' }) }} />
          <AddButton icon={Server} label="MCP Tool"      onClick={() => { setAddMode('mcp');      setDraft({ type: 'mcp' })      }} />
          <AddButton icon={Globe}  label="OpenAPI Tool"  onClick={() => { setAddMode('openapi');  setDraft({ type: 'openapi' })  }} />
        </div>
      )}

      {/* Add form */}
      {addMode === 'function' && (
        <AddForm title="Add Function Tool" onCommit={commitTool} onCancel={cancel}>
          <label className="block text-xs text-gray-400 mb-1">Function name</label>
          <select
            value={draft.name ?? ''}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            className={selectCls}
          >
            <option value="">Select or type below…</option>
            {BUILTIN_FUNCTIONS.map(fn => (
              <option key={fn} value={fn}>{fn}</option>
            ))}
          </select>
          <input
            className={`${inputCls} mt-2`}
            placeholder="Or type a custom function name"
            value={draft.name ?? ''}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
          <input
            className={`${inputCls} mt-2`}
            placeholder="Description (optional)"
            value={draft.description ?? ''}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          />
        </AddForm>
      )}

      {addMode === 'mcp' && (
        <AddForm title="Add MCP Tool" onCommit={commitTool} onCancel={cancel}>
          <label className="block text-xs text-gray-400 mb-1">MCP Server name</label>
          <input
            className={inputCls}
            placeholder="e.g. brave-search"
            value={draft.server ?? ''}
            onChange={e => setDraft(d => ({ ...d, server: e.target.value }))}
          />
          <label className="block text-xs text-gray-400 mb-1 mt-2">Tool name</label>
          <input
            className={inputCls}
            placeholder="e.g. search"
            value={draft.tool ?? ''}
            onChange={e => setDraft(d => ({ ...d, tool: e.target.value }))}
          />
        </AddForm>
      )}

      {addMode === 'openapi' && (
        <AddForm title="Add OpenAPI Tool" onCommit={commitTool} onCancel={cancel}>
          <label className="block text-xs text-gray-400 mb-1">OpenAPI spec URL</label>
          <input
            className={inputCls}
            placeholder="https://api.example.com/openapi.json"
            value={draft.spec_url ?? ''}
            onChange={e => setDraft(d => ({ ...d, spec_url: e.target.value }))}
          />
          <label className="block text-xs text-gray-400 mb-1 mt-2">Name</label>
          <input
            className={inputCls}
            placeholder="e.g. weather-api"
            value={draft.name ?? ''}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
        </AddForm>
      )}
    </div>
  )
}

function ToolChip({ tool, onRemove }: { tool: Tool; onRemove: () => void }) {
  const icon = tool.type === 'function' ? '⚡' : tool.type === 'mcp' ? '🔌' : '🌐'
  const label = tool.type === 'function'
    ? tool.name
    : tool.type === 'mcp'
    ? `${tool.server}/${tool.tool}`
    : tool.name ?? tool.spec_url

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border
                    border-gray-700 rounded-lg text-sm text-gray-300 group">
      <span>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-gray-500 capitalize">{tool.type}</span>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 ml-1"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function AddButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400
                 border border-dashed border-gray-700 rounded-lg
                 hover:border-blue-500 hover:text-blue-400 transition-colors"
    >
      <Icon size={12} />
      {label}
    </button>
  )
}

function AddForm({ title, onCommit, onCancel, children }: {
  title: string
  onCommit: () => void
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <div className="p-3 bg-gray-800 border border-gray-700 rounded-lg space-y-2">
      <p className="text-xs font-medium text-gray-300">{title}</p>
      {children}
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={onCommit}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">
          Add
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-gray-400 hover:text-white text-xs">
          Cancel
        </button>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500'
const selectCls = 'w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500'

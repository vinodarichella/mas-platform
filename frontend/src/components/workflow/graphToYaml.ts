import type { Node, Edge } from 'reactflow'

// ── Topological sort ─────────────────────────────────────────────────────────

function topoSort(nodes: Node[], edges: Edge[]): Node[] {
  const adj = new Map<string, string[]>()
  const inDeg = new Map<string, number>()
  nodes.forEach(n => { adj.set(n.id, []); inDeg.set(n.id, 0) })
  edges.forEach(e => {
    adj.get(e.source)?.push(e.target)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  })
  const queue = nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0)
  const result: Node[] = []
  while (queue.length) {
    const n = queue.shift()!
    result.push(n)
    for (const nxt of (adj.get(n.id) ?? [])) {
      const d = (inDeg.get(nxt) ?? 1) - 1
      inDeg.set(nxt, d)
      if (d === 0) queue.push(nodes.find(x => x.id === nxt)!)
    }
  }
  return result.filter(Boolean)
}

// ── YAML helpers ─────────────────────────────────────────────────────────────

function indent(s: string, n = 2): string {
  return s.split('\n').map(l => ' '.repeat(n) + l).join('\n')
}

function yamlStr(v: unknown): string {
  if (v == null || v === '') return '""'
  const s = String(v)
  return /[:#\[\]{}|>&*!,?]/.test(s) || s.includes('\n') ? JSON.stringify(s) : s
}

// ── Per-type YAML generators ─────────────────────────────────────────────────

function agentEntries(nodes: Node[], edges: Edge[],
                       orderedAgents: Node[], type: string): string {
  return orderedAgents.map((n, i) => {
    const d = n.data as Record<string, string>
    const nextEdge = edges.find(e => e.source === n.id)
    const nextNode = nextEdge ? nodes.find(x => x.id === nextEdge.target) : null
    const alias = d.alias || `step${i + 1}`
    let entry = `- id: ${alias}\n`
    entry    += `  ref: ${yamlStr(d.agentId || '')}\n`
    entry    += `  alias: ${yamlStr(alias)}\n`
    if (d.instructions) entry += `  instructions: ${yamlStr(d.instructions)}\n`
    if (type === 'handoff' && nextNode?.type === 'agent') {
      const nd = nextNode.data as Record<string, string>
      entry += `  handoff_to: ${yamlStr(nd.alias || nextNode.id)}\n`
    }
    if (type === 'sequential' && nextNode && nextNode.type !== 'end') {
      const nd = nextNode.data as Record<string, string>
      entry += `  next: ${yamlStr(nd.alias || nextNode.id)}\n`
    }
    return entry.trimEnd()
  }).join('\n')
}

// ── Main export ───────────────────────────────────────────────────────────────

export function graphToYaml(
  name: string,
  orchestrationType: string,
  nodes: Node[],
  edges: Edge[],
): string {
  const sorted      = topoSort(nodes, edges)
  const agentNodes  = sorted.filter(n => n.type === 'agent')
  const startNode   = nodes.find(n => n.type === 'start')
  const lines: string[] = []

  lines.push(`orchestration_type: ${orchestrationType}`)
  lines.push(`name: ${yamlStr(name)}`)
  lines.push('')

  // ── Sequential ─────────────────────────────────────────────────────────────
  if (orchestrationType === 'sequential') {
    lines.push('agents:')
    lines.push(indent(agentEntries(nodes, edges, agentNodes, 'sequential'), 2))
    return lines.join('\n')
  }

  // ── Concurrent ─────────────────────────────────────────────────────────────
  if (orchestrationType === 'concurrent') {
    lines.push('agents:')
    agentNodes.forEach((n, i) => {
      const d = n.data as Record<string, string>
      lines.push(`  - ref: ${yamlStr(d.agentId || '')}`)
      lines.push(`    alias: ${yamlStr(d.alias || `agent${i + 1}`)}`)
      if (d.instructions) lines.push(`    instructions: ${yamlStr(d.instructions)}`)
    })
    return lines.join('\n')
  }

  // ── Handoff ────────────────────────────────────────────────────────────────
  if (orchestrationType === 'handoff') {
    lines.push('agents:')
    lines.push(indent(agentEntries(nodes, edges, agentNodes, 'handoff'), 2))
    return lines.join('\n')
  }

  // ── GroupChat ──────────────────────────────────────────────────────────────
  if (orchestrationType === 'groupchat') {
    lines.push('max_rounds: 10')
    lines.push('agents:')
    agentNodes.forEach((n, i) => {
      const d = n.data as Record<string, string>
      lines.push(`  - ref: ${yamlStr(d.agentId || '')}`)
      lines.push(`    alias: ${yamlStr(d.alias || `agent${i + 1}`)}`)
      if (d.instructions) lines.push(`    instructions: ${yamlStr(d.instructions)}`)
    })
    return lines.join('\n')
  }

  // ── Magentic ───────────────────────────────────────────────────────────────
  if (orchestrationType === 'magentic') {
    const orch = agentNodes[0]
    const team  = agentNodes.slice(1)
    if (orch) {
      const d = orch.data as Record<string, string>
      lines.push('orchestrator:')
      lines.push(`  ref: ${yamlStr(d.agentId || '')}`)
      lines.push(`  alias: ${yamlStr(d.alias || 'orchestrator')}`)
    }
    if (team.length) {
      lines.push('team:')
      team.forEach((n, i) => {
        const d = n.data as Record<string, string>
        lines.push(`  - ref: ${yamlStr(d.agentId || '')}`)
        lines.push(`    alias: ${yamlStr(d.alias || `worker${i + 1}`)}`)
        if (d.instructions) lines.push(`    instructions: ${yamlStr(d.instructions)}`)
      })
    }
    return lines.join('\n')
  }

  // ── Declarative (full graph) ───────────────────────────────────────────────
  lines.push('steps:')
  sorted.forEach(n => {
    const d = n.data as Record<string, string>
    const outEdges = edges.filter(e => e.source === n.id)
    lines.push(`  - id: ${n.id}`)
    lines.push(`    type: ${n.type}`)

    if (n.type === 'agent') {
      lines.push(`    ref: ${yamlStr(d.agentId || '')}`)
      lines.push(`    alias: ${yamlStr(d.alias || n.id)}`)
      if (d.instructions) lines.push(`    instructions: ${yamlStr(d.instructions)}`)
      const nxt = outEdges[0]
      if (nxt) lines.push(`    next: ${nxt.target}`)
    }

    if (n.type === 'condition') {
      if (d.expression) lines.push(`    expression: ${yamlStr(d.expression)}`)
      const trueEdge  = outEdges.find(e => e.sourceHandle === 'true'  || e.label === 'true')
      const falseEdge = outEdges.find(e => e.sourceHandle === 'false' || e.label === 'false')
      if (trueEdge)  lines.push(`    on_true: ${trueEdge.target}`)
      if (falseEdge) lines.push(`    on_false: ${falseEdge.target}`)
    }

    if (n.type === 'hitl') {
      if (d.prompt) lines.push(`    prompt: ${yamlStr(d.prompt)}`)
      if (d.timeout) lines.push(`    timeout_minutes: ${d.timeout}`)
      const nxt = outEdges[0]
      if (nxt) lines.push(`    next: ${nxt.target}`)
    }

    if (n.type === 'parallelFork') {
      const branches = outEdges.map(e => e.target)
      if (branches.length) lines.push(`    branches: [${branches.join(', ')}]`)
    }

    if (n.type === 'parallelJoin') {
      const nxt = outEdges[0]
      if (nxt) lines.push(`    next: ${nxt.target}`)
    }

    if (n.type === 'start') {
      const nxt = outEdges[0]
      if (nxt) lines.push(`    next: ${nxt.target}`)
    }
  })

  return lines.join('\n')
}

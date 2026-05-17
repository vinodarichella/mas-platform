import type { Node, Edge } from 'reactflow'

// ── Simple line-by-line YAML parser ──────────────────────────────────────────
// Handles the specific subset of YAML produced by graphToYaml.ts.

interface YamlDoc {
  orchestration_type?: string
  name?: string
  max_rounds?: string
  agents?: YamlAgent[]
  orchestrator?: YamlAgent
  team?: YamlAgent[]
  steps?: YamlStep[]
}

interface YamlAgent {
  id?: string
  ref?: string
  alias?: string
  instructions?: string
  handoff_to?: string
  next?: string
}

interface YamlStep {
  id?: string
  type?: string
  ref?: string
  alias?: string
  instructions?: string
  next?: string
  expression?: string
  on_true?: string
  on_false?: string
  prompt?: string
  timeout_minutes?: string
  branches?: string
}

function parseYaml(yaml: string): YamlDoc {
  const lines   = yaml.split('\n')
  const doc: YamlDoc = {}
  let   i       = 0

  function line()  { return lines[i] ?? '' }
  function indent(l: string) { return l.match(/^(\s*)/)?.[1].length ?? 0 }
  function kv(l: string): [string, string] {
    const colonIdx = l.indexOf(':')
    if (colonIdx === -1) return ['', '']
    const key = l.slice(0, colonIdx).trim()
    const val = l.slice(colonIdx + 1).trim().replace(/^"(.*)"$/, '$1')
    return [key, val]
  }

  function parseBlock(baseIndent: number): Record<string, string> {
    const obj: Record<string, string> = {}
    while (i < lines.length) {
      const l = line()
      if (l.trim() === '' || l.trim().startsWith('#')) { i++; continue }
      const ind = indent(l)
      if (ind <= baseIndent) break
      const [k, v] = kv(l.trim())
      if (k) obj[k] = v
      i++
    }
    return obj
  }

  function parseList(baseIndent: number): Record<string, string>[] {
    const items: Record<string, string>[] = []
    while (i < lines.length) {
      const l = line()
      if (l.trim() === '' || l.trim().startsWith('#')) { i++; continue }
      const ind = indent(l)
      if (ind < baseIndent) break
      if (l.trim().startsWith('- ')) {
        // First key-value on the same line as '-'
        const firstLine = l.trim().slice(2)
        const item: Record<string, string> = {}
        if (firstLine.includes(':')) {
          const [k, v] = kv(firstLine)
          if (k) item[k] = v
        }
        i++
        // Subsequent keys at deeper indent
        while (i < lines.length) {
          const nl = line()
          if (nl.trim() === '' || nl.trim().startsWith('#')) { i++; continue }
          if (indent(nl) <= ind) break
          if (nl.trim().startsWith('- ')) break
          const [k, v] = kv(nl.trim())
          if (k) item[k] = v
          i++
        }
        items.push(item)
      } else {
        i++
      }
    }
    return items
  }

  while (i < lines.length) {
    const l = line()
    if (l.trim() === '' || l.trim().startsWith('#')) { i++; continue }
    const ind = indent(l)

    if (ind === 0) {
      if (l.startsWith('orchestration_type:')) { const [,v] = kv(l); doc.orchestration_type = v; i++; continue }
      if (l.startsWith('name:'))              { const [,v] = kv(l); doc.name = v;                i++; continue }
      if (l.startsWith('max_rounds:'))        { const [,v] = kv(l); doc.max_rounds = v;           i++; continue }

      if (l.startsWith('agents:'))      { i++; doc.agents      = parseList(0) as YamlAgent[];      continue }
      if (l.startsWith('team:'))        { i++; doc.team        = parseList(0) as YamlAgent[];      continue }
      if (l.startsWith('steps:'))       { i++; doc.steps       = parseList(0) as YamlStep[];       continue }
      if (l.startsWith('orchestrator:')){ i++; doc.orchestrator = parseBlock(0) as YamlAgent;      continue }
    }
    i++
  }

  return doc
}

// ── Position helpers ──────────────────────────────────────────────────────────

const GAP_X = 200
const GAP_Y = 140
const START_X = 60

// ── Graph builder ─────────────────────────────────────────────────────────────

export function yamlToGraph(yaml: string): { nodes: Node[]; edges: Edge[] } {
  const doc   = parseYaml(yaml)
  const type  = doc.orchestration_type ?? 'sequential'
  const nodes: Node[] = []
  const edges: Edge[] = []
  let   edgeId = 1
  const eid = () => `e${edgeId++}`

  function startNode(x: number, y: number): Node {
    return { id: 'start_1', type: 'start', position: { x, y }, data: {} }
  }
  function endNode(x: number, y: number): Node {
    return { id: 'end_1', type: 'end', position: { x, y }, data: {} }
  }
  function link(src: string, tgt: string) {
    edges.push({ id: eid(), source: src, target: tgt, animated: true })
  }

  // ── Sequential / Handoff ───────────────────────────────────────────────────
  if (type === 'sequential' || type === 'handoff') {
    const agents = doc.agents ?? []
    const midY   = 200

    nodes.push(startNode(START_X, midY))
    let prevId = 'start_1'

    agents.forEach((a, i) => {
      const id = a.id ?? a.alias ?? `agent_${i + 1}`
      nodes.push({
        id,
        type: 'agent',
        position: { x: START_X + GAP_X * (i + 1), y: midY },
        data: {
          alias:        a.alias ?? id,
          agentName:    a.alias ?? `Agent ${i + 1}`,
          agentId:      a.ref ?? '',
          instructions: a.instructions ?? '',
        },
      })
      link(prevId, id)
      prevId = id
    })

    const endX = START_X + GAP_X * (agents.length + 1)
    nodes.push(endNode(endX, midY))
    link(prevId, 'end_1')
    return { nodes, edges }
  }

  // ── Concurrent / GroupChat ─────────────────────────────────────────────────
  if (type === 'concurrent' || type === 'groupchat') {
    const agents = doc.agents ?? []
    const totalH = (agents.length - 1) * GAP_Y
    const startY = 200 - totalH / 2

    nodes.push(startNode(START_X, 200))
    const endX = START_X + GAP_X * 2

    agents.forEach((a, i) => {
      const id  = a.alias ?? `agent_${i + 1}`
      const y   = startY + i * GAP_Y
      nodes.push({
        id,
        type: 'agent',
        position: { x: START_X + GAP_X, y },
        data: {
          alias:        a.alias ?? id,
          agentName:    a.alias ?? `Agent ${i + 1}`,
          agentId:      a.ref ?? '',
          instructions: a.instructions ?? '',
        },
      })
      link('start_1', id)
      link(id, 'end_1')
    })

    nodes.push(endNode(endX, 200))
    return { nodes, edges }
  }

  // ── Magentic ───────────────────────────────────────────────────────────────
  if (type === 'magentic') {
    const orch = doc.orchestrator
    const team = doc.team ?? []
    const midY = 200 + (team.length - 1) * GAP_Y / 2

    nodes.push(startNode(START_X, midY))

    const orchId = orch?.alias ?? 'orchestrator'
    nodes.push({
      id: orchId,
      type: 'agent',
      position: { x: START_X + GAP_X, y: midY },
      data: {
        alias:     orchId,
        agentName: orch?.alias ?? 'Orchestrator',
        agentId:   orch?.ref ?? '',
      },
    })
    link('start_1', orchId)

    const totalH = (team.length - 1) * GAP_Y
    const teamStartY = midY - totalH / 2

    team.forEach((a, i) => {
      const id = a.alias ?? `worker_${i + 1}`
      nodes.push({
        id,
        type: 'agent',
        position: { x: START_X + GAP_X * 2, y: teamStartY + i * GAP_Y },
        data: {
          alias:        a.alias ?? id,
          agentName:    a.alias ?? `Worker ${i + 1}`,
          agentId:      a.ref ?? '',
          instructions: a.instructions ?? '',
        },
      })
      link(orchId, id)
      link(id, 'end_1')
    })

    nodes.push(endNode(START_X + GAP_X * 3, midY))
    return { nodes, edges }
  }

  // ── Declarative ────────────────────────────────────────────────────────────
  if (type === 'declarative') {
    const steps = doc.steps ?? []
    const posMap = new Map<string, { x: number; y: number }>()
    let col = 0

    steps.forEach((s, i) => {
      posMap.set(s.id ?? `step_${i}`, { x: START_X + col * GAP_X, y: 200 })
      col++
    })

    steps.forEach((s, i) => {
      const id  = s.id ?? `step_${i}`
      const pos = posMap.get(id) ?? { x: i * GAP_X, y: 200 }

      if (s.type === 'start' || s.type === 'end') {
        nodes.push({ id, type: s.type, position: pos, data: {} })
      } else if (s.type === 'agent') {
        nodes.push({
          id,
          type: 'agent',
          position: pos,
          data: {
            alias:        s.alias ?? id,
            agentName:    s.alias ?? id,
            agentId:      s.ref ?? '',
            instructions: s.instructions ?? '',
          },
        })
      } else if (s.type === 'condition') {
        nodes.push({
          id,
          type: 'condition',
          position: pos,
          data: { expression: s.expression ?? '' },
        })
        if (s.on_true)  edges.push({ id: eid(), source: id, target: s.on_true,  sourceHandle: 'true',  animated: true })
        if (s.on_false) edges.push({ id: eid(), source: id, target: s.on_false, sourceHandle: 'false', animated: true })
      } else if (s.type === 'hitl') {
        nodes.push({
          id,
          type: 'hitl',
          position: pos,
          data: { prompt: s.prompt ?? '', timeout: s.timeout_minutes ?? '30' },
        })
      } else {
        nodes.push({ id, type: s.type ?? 'agent', position: pos, data: {} })
      }

      if (s.next && s.type !== 'condition') {
        link(id, s.next)
      }
    })

    return { nodes, edges }
  }

  return { nodes, edges }
}

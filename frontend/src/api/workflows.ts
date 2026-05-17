import { api } from './client'

export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  label?: string
}

export interface GraphJson {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface WorkflowDto {
  id: string
  name: string
  description?: string
  orchestrationType: string
  graphJson: GraphJson
  yamlContent?: string
  isTemplate: boolean
  templateCategory?: string
  createdAt: string
  updatedAt: string
}

export interface WorkflowRequest {
  name: string
  description?: string
  orchestrationType: string
  graphJson?: GraphJson
  yamlContent?: string
  isTemplate?: boolean
  templateCategory?: string
}

export const workflowsApi = {
  list:   ()                                    => api.get<WorkflowDto[]>('/workflows').then(r => r.data),
  create: (req: WorkflowRequest)                => api.post<WorkflowDto>('/workflows', req).then(r => r.data),
  get:    (id: string)                          => api.get<WorkflowDto>(`/workflows/${id}`).then(r => r.data),
  update: (id: string, req: WorkflowRequest)    => api.put<WorkflowDto>(`/workflows/${id}`, req).then(r => r.data),
  delete: (id: string)                          => api.delete(`/workflows/${id}`),
}

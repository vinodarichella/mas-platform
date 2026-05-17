import { api } from './client'

export interface TemplateDto {
  id: string
  name: string
  description: string | null
  category: string | null
  orchestrationType: string
  graphJson: { nodes: unknown[]; edges: unknown[] }
  yamlContent: string | null
  isBuiltin: boolean
  createdAt: string
}

export interface SaveAsTemplateRequest {
  name?: string
  description?: string
  category?: string
}

export const templatesApi = {
  list: (category?: string) =>
    api.get<TemplateDto[]>('/templates', { params: category ? { category } : {} }).then(r => r.data),
  get: (id: string) =>
    api.get<TemplateDto>(`/templates/${id}`).then(r => r.data),
  saveAsTemplate: (workflowId: string, req: SaveAsTemplateRequest) =>
    api.post<TemplateDto>(`/templates/from-workflow/${workflowId}`, req).then(r => r.data),
}

import { api } from './client'

export interface Tool {
  type: 'function' | 'mcp' | 'openapi'
  // function tool
  name?: string
  description?: string
  // mcp tool
  server?: string
  tool?: string
  // openapi tool
  spec_url?: string
}

export interface AgentDto {
  id: string
  name: string
  instructions: string
  provider: string
  model: string
  tools: Tool[]
  skills: string[]
  middleware: string[]
  memoryEnabled: boolean
  runMode: 'interactive' | 'background'
  maxRunDurationMinutes: number
  personalizationPrompt?: string
  createdAt: string
  updatedAt: string
}

export interface AgentRequest {
  name: string
  instructions: string
  provider: string
  model: string
  tools: Tool[]
  skills: string[]
  middleware: string[]
  memoryEnabled: boolean
  runMode: 'interactive' | 'background'
  maxRunDurationMinutes: number
  personalizationPrompt?: string
}

export interface ProvidersResponse {
  configured: Record<string, string[]>
  all: Record<string, string[]>
}

export const agentsApi = {
  list:      ()                              => api.get<AgentDto[]>('/agents').then(r => r.data),
  create:    (req: AgentRequest)             => api.post<AgentDto>('/agents', req).then(r => r.data),
  get:       (id: string)                    => api.get<AgentDto>(`/agents/${id}`).then(r => r.data),
  update:    (id: string, req: AgentRequest) => api.put<AgentDto>(`/agents/${id}`, req).then(r => r.data),
  delete:    (id: string)                    => api.delete(`/agents/${id}`),
  providers: ()                              => api.get<ProvidersResponse>('/agents/providers').then(r => r.data),
  test:      (id: string, message: string)   =>
    api.post<{ runId: string; status: string }>(`/agents/${id}/test`, { message }).then(r => r.data),
}

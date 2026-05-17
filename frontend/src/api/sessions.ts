import { api } from './client'

export interface Session {
  id: string
  name: string
  workflowId?: string
  createdAt: string
  lastActiveAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  sequenceId: number
  createdAt: string
}

export interface ChatResponse {
  runId: string
  messageId: string
  status: string
}

export const sessionsApi = {
  list: ()                          => api.get<Session[]>('/sessions').then(r => r.data),
  create: (name: string)            => api.post<Session>('/sessions', { name }).then(r => r.data),
  get: (id: string)                 => api.get<Session>(`/sessions/${id}`).then(r => r.data),
  delete: (id: string)              => api.delete(`/sessions/${id}`),
  messages: (id: string)            => api.get<ChatMessage[]>(`/sessions/${id}/messages`).then(r => r.data),
  chat: (id: string, message: string, background = false) =>
    api.post<ChatResponse>(`/sessions/${id}/chat`, { message, background }).then(r => r.data),
}

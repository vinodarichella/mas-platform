import { api } from './client'

export interface Run {
  id: string
  sessionId?: string
  workflowId?: string
  userId: string
  status: 'queued' | 'running' | 'paused_hitl' | 'completed' | 'failed' | 'cancelled'
  jobType: 'interactive' | 'background'
  lastEventSeq: number
  inputData: Record<string, unknown>
  outputData?: Record<string, unknown>
  errorMessage?: string
  startedAt: string
  completedAt?: string
}

export const runsApi = {
  list: () => api.get<Run[]>('/runs').then(r => r.data),
  get:  (id: string) => api.get<Run>(`/runs/${id}`).then(r => r.data),
  cancel: (id: string) => api.post(`/runs/${id}/cancel`),
  submitHitl: (runId: string, hitlId: string, response: Record<string, unknown>) =>
    api.post(`/runs/${runId}/hitl`, { hitlId, response }),
}

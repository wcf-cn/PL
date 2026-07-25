import axios from 'axios'
import type { Member, Requirement, Milestone, ChatMessage, DraftResult, AIAction, MemberSnapshot, Version, FlowMetrics, TimeEntry, VersionMergePoint } from './types'

// baseURL='' 同源(单端口部署)。base 路径必须带尾斜杠:DRF DefaultRouter
// 注册强制尾斜杠,Django APPEND_SLASH 对 GET 能 301 补救但对 POST/PATCH/DELETE
// 会抛 RuntimeError 500(不能在保留 body 下重定向)。
const http = axios.create({ baseURL: '', withCredentials: true })
http.interceptors.response.use(r => r, e => {
  // DRF IsAuthenticated 失败返回 403(NoCSRFSessionAuthentication 不带 WWW-Authenticate),
  // 所以 401 和 403 都视为未登录 → 跳登录页。
  if (e.response?.status === 401 || e.response?.status === 403) window.location.hash = '#/login'
  return Promise.reject(e)
})
const crud = <T>(base: string): {
  list: (params?: Record<string, string>) => Promise<T[]>
  create: (d: Partial<T>) => Promise<T>
  update: (id: number, d: Partial<T>) => Promise<T>
  remove: (id: number) => Promise<void>
} => ({
  list: (params?: Record<string, string>) => http.get(base, { params }).then(r => r.data as T[]),
  create: (d: Partial<T>) => http.post(base, d).then(r => r.data as T),
  update: (id: number, d: Partial<T>) => http.patch(`${base}${id}/`, d).then(r => r.data as T),
  remove: (id: number) => http.delete(`${base}${id}/`).then(() => undefined),
})
export const api = {
  me: () => http.get<{username:string}>('/api/auth/me').then(r => r.data),
  login: (username:string, password:string) => http.post('/api/auth/login', { username, password }).then(r => r.data),
  logout: () => http.post('/api/auth/logout'),
  members: crud<Member>('/api/members/'),
  requirements: crud<Requirement>('/api/requirements/'),
  versions: crud<Version>('/api/versions/'),
  versionMergePoints: crud<VersionMergePoint>('/api/version-merge-points/'),
  milestones: crud<Milestone>('/api/milestones/'),
  timeEntries: crud<TimeEntry>('/api/time-entries/'),
  aiChat: (message: string, history: ChatMessage[]) =>
    http.post<{reply: string, drafts: DraftResult | null, actions: AIAction[]}>('/api/ai/chat/', { message, history }).then(r => r.data),
  aiExecute: (action: AIAction) =>
    http.post<{success: boolean; message: string}>('/api/ai/execute/', action).then(r => r.data),
  snapshots: () => http.get<MemberSnapshot[]>('/api/snapshots/').then(r => r.data),
  metricsFlow: () => http.get<FlowMetrics>('/api/metrics/flow/').then(r => r.data),
}

import axios from 'axios'
import type { Member, Sprint, Requirement, CapacityRow } from './types'
const http = axios.create({ baseURL: '', withCredentials: true })
http.interceptors.response.use(r => r, e => {
  if (e.response?.status === 401) window.location.hash = '#/login'
  return Promise.reject(e)
})
const crud = <T>(base: string) => ({
  list: (params?:Record<string,string>) => http.get<T[]>(base, { params }).then(r => r.data),
  create: (d: Partial<T>) => http.post<T>(base, d).then(r => r.data),
  update: (id:number, d: Partial<T>) => http.patch<T>(`${base}/${id}`, d).then(r => r.data),
  remove: (id:number) => http.delete(`${base}/${id}`),
})
export const api = {
  me: () => http.get<{username:string}>('/api/auth/me').then(r => r.data),
  login: (username:string, password:string) => http.post('/api/auth/login', { username, password }).then(r => r.data),
  logout: () => http.post('/api/auth/logout'),
  members: crud<Member>('/api/members'),
  sprints: crud<Sprint>('/api/sprints'),
  requirements: crud<Requirement>('/api/requirements'),
  capacity: (sprint:number) => http.get<CapacityRow[]>('/api/capacity', { params: { sprint } }).then(r => r.data),
}

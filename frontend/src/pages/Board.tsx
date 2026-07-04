import { useEffect, useState } from 'react'
import { api } from '../api'
import { STATUS_LABEL, STATUS_ORDER, type Requirement, type Status, type Member, type Sprint, type Priority } from '../types'
const PRIO_COLOR: Record<string,string> = { P0:'bg-red-100 text-red-700', P1:'bg-yellow-100 text-yellow-700', P2:'bg-gray-100 text-gray-700' }

export default function Board() {
  const [items, setItems] = useState<Requirement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const load = () => api.requirements.list().then(setItems)
  useEffect(() => {
    load()
    api.members.list().then(setMembers)
    api.sprints.list().then(setSprints)
  }, [])
  const onDrop = async (status: Status, id: number) => {
    const r = items.find(x => x.id === id); if (!r || r.status === status) return
    setItems(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    await api.requirements.update(id, { status })
  }

  const [form, setForm] = useState({
    title: '',
    status: 'backlog' as Status,
    priority: 'P1' as Priority,
    assignee: null as number | null,
    module: '',
    est_effort: '',
    assigned_sprint: null as number | null
  })

  const createReq = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      const payload = {
        title: form.title,
        status: form.status,
        priority: form.priority,
        assignee: form.assignee,
        module: form.module || '',
        est_effort: form.est_effort ? Number(form.est_effort) : 0,
        assigned_sprint: form.assigned_sprint
      }
      const created = await api.requirements.create(payload)
      setItems(prev => [created, ...prev])
      setShowForm(false)
      setError('')
      setForm({ title: '', status: 'backlog', priority: 'P1', assignee: null, module: '', est_effort: '', assigned_sprint: null })
    } catch (err: any) {
      setError(err.response?.data?.message || '创建失败')
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1 bg-blue-500 text-white rounded">
          + 新建需求
        </button>
      </div>

      {showForm && (
        <form onSubmit={createReq} className="mb-4 p-4 bg-gray-50 rounded">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">标题 *</label>
              <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                className="w-full px-2 py-1 border rounded" placeholder="请输入标题" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">状态</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value as Status})}
                className="w-full px-2 py-1 border rounded">
                {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">优先级</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as Priority})}
                className="w-full px-2 py-1 border rounded">
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">负责人</label>
              <select value={form.assignee || ''} onChange={e => setForm({...form, assignee: e.target.value ? Number(e.target.value) : null})}
                className="w-full px-2 py-1 border rounded">
                <option value="">未分配</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">模块</label>
              <input value={form.module} onChange={e => setForm({...form, module: e.target.value})}
                className="w-full px-2 py-1 border rounded" placeholder="模块名称" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">预计工时h</label>
              <input type="number" value={form.est_effort} onChange={e => setForm({...form, est_effort: e.target.value})}
                className="w-full px-2 py-1 border rounded" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">所属迭代</label>
              <select value={form.assigned_sprint || ''} onChange={e => setForm({...form, assigned_sprint: e.target.value ? Number(e.target.value) : null})}
                className="w-full px-2 py-1 border rounded">
                <option value="">未分配</option>
                {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          <div className="mt-3 flex gap-2">
            <button type="submit" className="px-4 py-1 bg-blue-500 text-white rounded">提交</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1 bg-gray-300 rounded">取消</button>
          </div>
        </form>
      )}

      <div className="flex gap-3 overflow-x-auto">
        {STATUS_ORDER.map(st => (
          <Column key={st} status={st} items={items.filter(r => r.status === st)} onDrop={onDrop} />
        ))}
      </div>
    </div>
  )
}

function Column({ status, items, onDrop }:{ status:Status; items:Requirement[]; onDrop:(s:Status,id:number)=>void }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e=>{e.preventDefault();setOver(true)}}
      onDragLeave={()=>setOver(false)}
      onDrop={()=>{setOver(false)}}
      className={`w-64 shrink-0 p-2 rounded bg-gray-50 ${over?'ring-2 ring-blue-400':''}`}
    >
      <div className="flex justify-between mb-2">
        <b>{STATUS_LABEL[status]}</b><span className="text-gray-400">{items.length}</span>
      </div>
      <div
        onDrop={e=>{e.stopPropagation(); onDrop(status, Number((e as any).dataTransfer.getData('id')))}}
        className="min-h-[40px] space-y-2"
      >
        {items.map(r => (
          <div key={r.id} draggable onDragStart={e=>(e as any).dataTransfer.setData('id', String(r.id))}
            className="p-2 bg-white rounded shadow cursor-move">
            <div className="font-medium">{r.title}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span className={`px-1 rounded ${PRIO_COLOR[r.priority]}`}>{r.priority}</span>
              <span>{r.assignee_name||'未分配'}</span>
              <span>{r.est_effort}h</span>
              <span>{r.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
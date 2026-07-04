import { useEffect, useState } from 'react'
import { api } from '../api'
import { STATUS_LABEL, STATUS_ORDER, type Requirement, type Status, type Member, type Sprint, type Priority } from '../types'
const PRIO_COLOR: Record<string,string> = { P0:'bg-red-100 text-red-700', P1:'bg-yellow-100 text-yellow-700', P2:'bg-gray-100 text-gray-700' }

export default function Board() {
  const [items, setItems] = useState<Requirement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [milestones, setMilestones] = useState<any[]>([])
  const [mtitle, setMTitle] = useState('')
  const [mdate, setMDate] = useState('')
  const [mnote, setMNote] = useState('')
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

  const loadMilestones = async (reqId: number) => {
    try {
      const data = await api.milestones.list({ requirement: String(reqId) })
      setMilestones(data)
    } catch {
      setMilestones([])
    }
  }

  const startEdit = (item: Requirement) => {
    setEditingId(item.id)
    setForm({
      title: item.title,
      status: item.status,
      priority: item.priority,
      assignee: item.assignee,
      module: item.module,
      est_effort: String(item.est_effort),
      assigned_sprint: item.assigned_sprint
    })
    setShowForm(true)
    loadMilestones(item.id)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setMilestones([])
    setError('')
    setForm({ title: '', status: 'backlog', priority: 'P1', assignee: null, module: '', est_effort: '', assigned_sprint: null })
    setMTitle(''); setMDate(''); setMNote('')
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
        est_effort: Number(form.est_effort) || 0,
        assigned_sprint: form.assigned_sprint
      }
      if (editingId) {
        const updated = await api.requirements.update(editingId, payload)
        setItems(prev => prev.map(x => x.id === editingId ? updated : x))
      } else {
        const created = await api.requirements.create(payload)
        setItems(prev => [created, ...prev])
      }
      closeForm()
    } catch (err: any) {
      const d = err.response?.data
      let msg = editingId ? '更新失败' : '创建失败'
      if (typeof d === 'string') msg = d
      else if (d?.detail) msg = d.detail
      else if (d && typeof d === 'object') msg = Object.entries(d).map(([f, e]) => `${f}: ${Array.isArray(e) ? e.join(',') : e}`).join('; ')
      setError(msg)
    }
  }

  const addMilestone = async () => {
    if (!editingId) return
    if (!mtitle.trim() || !mdate) return
    try {
      await api.milestones.create({ requirement: editingId, title: mtitle, date: mdate, note: mnote })
      setMTitle(''); setMDate(''); setMNote('')
      loadMilestones(editingId)
    } catch {
      setError('添加里程碑失败')
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
          <div className="mb-2 font-bold">{editingId ? '编辑需求' : '新建需求'}</div>
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

          {editingId && (
            <div className="mt-4 pt-4 border-t">
              <div className="font-bold mb-2">里程碑 ({milestones.length})</div>
              <div className="space-y-2 mb-3">
                {milestones.map(m => (
                  <div key={m.id} className="text-sm p-2 bg-white rounded border">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-gray-500">{m.date} {m.note && `- ${m.note}`}</div>
                  </div>
                ))}
                {milestones.length === 0 && <div className="text-gray-400 text-sm">暂无里程碑</div>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input value={mtitle} onChange={e=>setMTitle(e.target.value)} placeholder="里程碑标题" className="px-2 py-1 border rounded text-sm" />
                <input type="date" value={mdate} onChange={e=>setMDate(e.target.value)} className="px-2 py-1 border rounded text-sm" />
                <div className="flex gap-2">
                  <input value={mnote} onChange={e=>setMNote(e.target.value)} placeholder="备注" className="flex-1 px-2 py-1 border rounded text-sm" />
                  <button type="button" onClick={addMilestone} className="px-3 py-1 bg-green-500 text-white rounded text-sm">添加</button>
                </div>
              </div>
            </div>
          )}

          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
          <div className="mt-3 flex gap-2">
            <button type="submit" className="px-4 py-1 bg-blue-500 text-white rounded">提交</button>
            <button type="button" onClick={closeForm} className="px-4 py-1 bg-gray-300 rounded">取消</button>
          </div>
        </form>
      )}

      <div className="flex gap-3 overflow-x-auto">
        {STATUS_ORDER.map(st => (
          <Column key={st} status={st} items={items.filter(r => r.status === st)} onDrop={onDrop} onEdit={startEdit} />
        ))}
      </div>
    </div>
  )
}

function Column({ status, items, onDrop, onEdit }:{ status:Status; items:Requirement[]; onDrop:(s:Status,id:number)=>void; onEdit:(r:Requirement)=>void }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e=>{e.preventDefault();setOver(true)}}
      onDragLeave={()=>setOver(false)}
      onDrop={(e:any)=>{setOver(false); const id=Number((e as any).dataTransfer.getData('id')); if (id) onDrop(status, id)}}
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
          <div key={r.id} draggable onDragStart={e=>(e as any).dataTransfer.setData('id', String(r.id))} onDoubleClick={()=>onEdit(r)}
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
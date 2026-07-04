import { useEffect, useState } from 'react'
import { api } from '../api'
import { STATUS_LABEL, STATUS_ORDER, type Requirement, type Status } from '../types'
const PRIO_COLOR: Record<string,string> = { P0:'bg-red-100 text-red-700', P1:'bg-yellow-100 text-yellow-700', P2:'bg-gray-100 text-gray-700' }

export default function Board() {
  const [items, setItems] = useState<Requirement[]>([])
  const load = () => api.requirements.list().then(setItems)
  useEffect(() => { load() }, [])
  const onDrop = async (status: Status, id: number) => {
    const r = items.find(x => x.id === id); if (!r || r.status === status) return
    setItems(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    await api.requirements.update(id, { status })
  }
  return (
    <div className="flex gap-3 overflow-x-auto">
      {STATUS_ORDER.map(st => (
        <Column key={st} status={st} items={items.filter(r => r.status === st)} onDrop={onDrop} />
      ))}
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
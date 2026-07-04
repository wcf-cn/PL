import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Sprint, CapacityRow } from '../types'
function color(u:number){ if(u>1) return 'bg-red-100 text-red-700'; if(u>=0.8) return 'bg-yellow-100 text-yellow-700'; return 'bg-green-100 text-green-700' }

export default function Capacity() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sid, setSid] = useState<number|''>('')
  const [rows, setRows] = useState<CapacityRow[]>([])
  useEffect(() => { api.sprints.list().then(s => { setSprints(s); const a = s.find(x=>x.is_active); setSid(a?a.id:s[0]?.id??'') }) }, [])
  useEffect(() => { if (sid) api.capacity(Number(sid)).then(setRows) }, [sid])
  return (
    <div>
      <select className="border p-2 mb-3" value={sid} onChange={e=>setSid(Number(e.target.value))}>
        {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <table className="border-collapse">
        <thead><tr className="text-left">
          <th className="p-2 border">成员</th><th className="p-2 border">容量(h)</th>
          <th className="p-2 border">占用(h)</th><th className="p-2 border">利用率</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.member_id}>
              <td className="p-2 border">{r.member}</td>
              <td className="p-2 border">{r.capacity}</td>
              <td className="p-2 border">{r.load}</td>
              <td className={`p-2 border ${color(r.utilization)}`}>{(r.utilization*100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500 mt-2">绿&lt;80% · 黄 80–100% · 红&gt;100% 超载。已按利用率降序(后端排序)。</p>
    </div>
  )
}
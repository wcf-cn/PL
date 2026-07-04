import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { api } from '../api'
import type { Sprint, Requirement, Status } from '../types'

const DONE_STATUSES: Status[] = ['done', 'paused']

export default function Burndown() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sid, setSid] = useState<number | ''>('')
  const [reqs, setReqs] = useState<Requirement[]>([])

  useEffect(() => {
    api.sprints.list().then(s => {
      setSprints(s)
      const active = s.find(x => x.is_active)
      setSid(active ? active.id : s[0]?.id ?? '')
    })
  }, [])

  useEffect(() => {
    if (sid) api.requirements.list({ assigned_sprint: String(sid) }).then(setReqs)
  }, [sid])

  const sprint = sprints.find(s => s.id === sid)
  if (!sprint) return <div>加载中…</div>

  const total = reqs.reduce((sum, r) => sum + r.est_effort, 0)
  const remaining = reqs.filter(r => !DONE_STATUSES.includes(r.status)).reduce((sum, r) => sum + r.est_effort, 0)

  const start = new Date(sprint.start_date)
  const end = new Date(sprint.end_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const idealData = [
    { date: sprint.start_date, 理想线: total },
    { date: sprint.end_date, 理想线: 0 }
  ]

  const actualData = today >= start && today <= end
    ? [{ date: new Date().toISOString().split('T')[0], 实际: remaining }]
    : []

  return (
    <div>
      <select className="border p-2 mb-3" value={sid} onChange={e => setSid(Number(e.target.value))}>
        {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div className="mb-3">
        总工时 {total}h / 剩余 {remaining}h
      </div>
      <LineChart width={600} height={300} data={[...idealData, ...actualData]}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="linear" dataKey="理想线" stroke="#8884d8" strokeDasharray="5 5" />
        <Line type="monotone" dataKey="实际" stroke="#82ca9d" strokeWidth={2} />
      </LineChart>
    </div>
  )
}

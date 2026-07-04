import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { api } from '../api'
import type { Sprint, Requirement, Status } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'

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

  const total = reqs.reduce((sum, r) => sum + (r.est_effort || 0), 0)
  const remaining = reqs.filter(r => !DONE_STATUSES.includes(r.status)).reduce((sum, r) => sum + (r.est_effort || 0), 0)

  // Parse dates consistently as local midnight
  const parseDate = (d: string) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
  const start = parseDate(sprint.start_date)
  const end = parseDate(sprint.end_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const idealData = [
    { date: sprint.start_date, 理想线: total },
    { date: sprint.end_date, 理想线: 0 }
  ]

  const actualData = today >= start && today <= end
    ? [{ date: today.toISOString().split('T')[0], 实际: remaining }]
    : []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>燃尽图</CardTitle>
          <Select value={sid?.toString() || ''} onValueChange={(v) => setSid(v ? Number(v) : '')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择迭代" />
            </SelectTrigger>
            <SelectContent>
              {sprints.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            总工时 {total}h / 剩余 {remaining}h
          </p>
        </div>
        <div className="flex justify-center">
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
      </CardContent>
    </Card>
  )
}

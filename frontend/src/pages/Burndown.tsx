import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import type { BurndownData, Sprint } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'

export default function Burndown() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sid, setSid] = useState<number | ''>('')
  const [burndownData, setBurndownData] = useState<BurndownData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.sprints.list().then(s => {
      setSprints(s)
      const active = s.find(x => x.is_active)
      setSid(active ? active.id : s[0]?.id ?? '')
    })
  }, [])

  useEffect(() => {
    if (sid) {
      setLoading(true)
      api.burndown(Number(sid)).then(data => {
        setBurndownData(data)
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [sid])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">加载中…</div>
  if (!burndownData) return <Card className="p-6"><CardContent className="text-sm text-muted-foreground">暂无数据</CardContent></Card>

  const { sprint, total_effort, snapshots } = burndownData

  // Generate ideal line data points (start with total, end with 0)
  const startDate = new Date(sprint.start_date)
  const endDate = new Date(sprint.end_date)
  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  const idealLine = Array.from({ length: dayCount + 1 }, (_, i) => {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const progress = i / dayCount
    return {
      date: date.toISOString().split('T')[0],
      理想线: total_effort * (1 - progress)
    }
  })

  // Convert snapshots to actual line data
  const actualLine = snapshots.map(s => ({
    date: s.date,
    实际线: s.remaining_effort
  }))

  // Merge and sort by date
  const allData = [...idealLine, ...actualLine].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

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
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">总工时: {total_effort}h</span>
          <span className="text-muted-foreground">剩余: {snapshots.length > 0 ? snapshots[snapshots.length - 1].remaining_effort : 0}h</span>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={allData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--muted-foreground))"
              label={{ value: '剩余工时 (h)', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
            <Legend />
            <Line
              type="linear"
              dataKey="理想线"
              stroke="hsl(var(--chart-1))"
              strokeDasharray="5 5"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="实际线"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={{ r: 4, fill: 'hsl(var(--chart-2))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

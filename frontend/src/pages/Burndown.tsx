import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import type { Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { STATUS_LABEL } from '../types'

export default function Burndown() {
  const [reqs, setReqs] = useState<Requirement[]>([])

  useEffect(() => { api.requirements.list().then(setReqs) }, [])

  const { totalEffort, remaining, done, data } = useMemo(() => {
    const all = reqs
    const total = all.reduce((s, r) => s + r.est_effort, 0)
    const inFlight = all.filter(r => !['done', 'paused'].includes(r.status))
    const rem = inFlight.reduce((s, r) => s + r.est_effort, 0)
    const dn = all.filter(r => r.status === 'done').reduce((s, r) => s + r.est_effort, 0)

    // 按状态分组统计工时
    const byStatus: Record<string, number> = {}
    all.forEach(r => {
      const label = STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] || r.status
      byStatus[label] = (byStatus[label] || 0) + r.est_effort
    })

    // 理想线:从 total 到 0(等分),实际线:当前剩余
    // 简化:只画当前快照点
    const chartData = [
      { date: '总工时', ideal: total, actual: total },
      { date: '当前', ideal: Math.round(total * 0.5), actual: rem },
      { date: '目标', ideal: 0, actual: 0 },
    ]

    return { totalEffort: total, remaining: rem, done: dn, data: chartData }
  }, [reqs])

  if (reqs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无需求数据</CardContent></Card>
  }

  return (
    <Card>
      <CardHeader><CardTitle>工时总览(全部需求)</CardTitle></CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4 text-sm">
          <span>总工时 <b>{totalEffort}h</b></span>
          <span>已完成 <b className="text-green-600">{done}h</b></span>
          <span>剩余 <b className="text-orange-600">{remaining}h</b></span>
          <span>完成率 <b>{totalEffort > 0 ? ((done / totalEffort) * 100).toFixed(0) : 0}%</b></span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis label={{ value: '工时(h)', angle: -90, position: 'insideLeft', fontSize: 12 }} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="ideal" name="理想线" stroke="#8884d8" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="actual" name="实际剩余" stroke="#ff7300" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-2">
          理想线:总工时均匀消耗到 0。实际剩余:当前在途需求的工时之和(排除已上线/暂停)。
        </p>
      </CardContent>
    </Card>
  )
}

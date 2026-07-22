import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { api } from '../api'
import type { Requirement, Member } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084fe', '#fab1a0']

export default function Burndown() {
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    api.requirements.list().then(setReqs)
    api.members.list().then(setMembers)
  }, [])

  const { totalEffort, invested, actualRemaining, chartData, activeMembers } = useMemo(() => {
    const inFlight = reqs.filter(r => !['done', 'paused'].includes(r.status))
    const total = inFlight.reduce((s, r) => s + r.est_effort, 0)
    const inv = inFlight.reduce((s, r) => s + r.actual_effort, 0)
    const rem = total - inv

    const dated = inFlight.filter(r => r.planned_start && r.planned_end && r.assignee)
    if (dated.length === 0) return { totalEffort: total, invested: inv, actualRemaining: rem, chartData: [], activeMembers: [] }

    const activeMems = members.filter(m => m.active && inFlight.some(r => r.assignee === m.id && r.planned_start))

    const minDate = new Date(Math.min(...dated.map(r => new Date(r.planned_start!).getTime())))
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const maxDate = new Date(Math.max(today.getTime(), ...dated.map(r => new Date(r.planned_end || r.planned_start!).getTime())))

    // 理想线:每人从总量均匀消耗到0(按 planned_start~end)
    // 实际线:今天处 = est - actual(实际剩余);过去=估算;未来=理想
    const data: Array<Record<string, number | string>> = []
    const todayStr = today.toISOString().split('T')[0]

    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0]
      const isPast = ds < todayStr
      const isToday = ds === todayStr
      const row: Record<string, number | string> = { date: ds }

      for (const m of activeMems) {
        const myReqs = inFlight.filter(r => r.assignee === m.id && r.planned_start && r.planned_end)
        if (myReqs.length === 0) { row[m.name] = 0; continue }

        if (isPast) {
          // 过去:按计划进度算(理想线)
          const plannedRemain = myReqs.reduce((s, r) => {
            const start = new Date(r.planned_start!).getTime()
            const end = new Date(r.planned_end!).getTime()
            const now = d.getTime()
            if (now <= start) return s + r.est_effort
            if (now >= end) return s
            const pct = (now - start) / (end - start)
            return s + r.est_effort * (1 - pct)
          }, 0)
          row[m.name] = Math.round(plannedRemain * 10) / 10
        } else {
          // 今天及未来:用实际剩余(est - actual),之后按理想消耗到0
          if (isToday) {
            const actualRemain = myReqs.reduce((s, r) => s + (r.est_effort - r.actual_effort), 0)
            row[m.name] = Math.round(actualRemain * 10) / 10
          } else {
            // 未来:从今天的实际剩余,按日期均匀消耗到最晚 planned_end
            const actualRemain = myReqs.reduce((s, r) => s + (r.est_effort - r.actual_effort), 0)
            const latestEnd = Math.max(...myReqs.map(r => new Date(r.planned_end!).getTime()))
            const totalSpan = latestEnd - today.getTime()
            const elapsed = d.getTime() - today.getTime()
            if (totalSpan <= 0 || elapsed >= totalSpan) {
              row[m.name] = 0
            } else {
              const pct = elapsed / totalSpan
              row[m.name] = Math.round(actualRemain * (1 - pct) * 10) / 10
            }
          }
        }
      }
      data.push(row)
    }

    return { totalEffort: total, invested: inv, actualRemaining: rem, chartData: data, activeMembers: activeMems }
  }, [reqs, members])

  if (reqs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无需求数据</CardContent></Card>
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const completionRate = totalEffort > 0 ? ((invested / totalEffort) * 100).toFixed(0) : 0

  return (
    <Card>
      <CardHeader><CardTitle>每人燃尽(实际剩余工时)</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <span>在途总工时 <b>{totalEffort}h</b></span>
          <span>已投入 <b className="text-blue-600">{invested}h</b></span>
          <span>实际剩余 <b className="text-orange-600">{actualRemaining}h</b></span>
          <span>完成率 <b>{completionRate}%</b></span>
        </div>
        {chartData.length > 0 && activeMembers.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={50} />
              <YAxis label={{ value: '剩余工时(h)', angle: -90, position: 'insideLeft', fontSize: 12 }} tick={{ fontSize: 12 }} />
              <Tooltip labelStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x={todayStr} stroke="#ff4444" strokeWidth={2} label={{ value: '今天', position: 'top', fill: '#ff4444', fontSize: 11 }} />
              {activeMembers.map((m, i) => (
                <Line key={m.id} type="monotone" dataKey={m.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground">在途需求没有计划日期或未分配负责人,无法画趋势。</div>
        )}
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>📊 纵轴 = 剩余工时(est_effort - actual_effort,每人在途需求)</p>
          <p>📊 红线左边(过去)= 按计划日期的理想进度;红线处(今天)= 实际剩余;红线右边(未来)= 从实际剩余按计划消耗到 0</p>
          <p>📊 线在红线处突然下降 = 实际投入比计划慢(落后);线高于过去段 = 需求增加了</p>
        </div>
      </CardContent>
    </Card>
  )
}

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

  const { totalEffort, remaining, done, chartData, activeMembers } = useMemo(() => {
    const total = reqs.reduce((s, r) => s + r.est_effort, 0)
    const inFlight = reqs.filter(r => !['done', 'paused'].includes(r.status))
    const rem = inFlight.reduce((s, r) => s + r.est_effort, 0)
    const dn = reqs.filter(r => r.status === 'done').reduce((s, r) => s + r.est_effort, 0)

    const dated = reqs.filter(r => r.planned_start && r.assignee)
    if (dated.length === 0) return { totalEffort: total, remaining: rem, done: dn, chartData: [], activeMembers: [] }

    const activeMems = members.filter(m => m.active && reqs.some(r => r.assignee === m.id && r.planned_start))

    const minDate = new Date(Math.min(...dated.map(r => new Date(r.planned_start!).getTime())))
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const maxDate = new Date(Math.max(today.getTime(), ...dated.map(r => new Date(r.planned_end || r.planned_start!).getTime())))

    // 每天每人的剩余工时
    const data: Array<Record<string, number | string>> = []
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0]
      const row: Record<string, number | string> = { date: ds }
      for (const m of activeMems) {
        const remain = reqs
          .filter(r => r.assignee === m.id && r.status !== 'paused' && (!r.planned_end || r.planned_end >= ds))
          .reduce((s, r) => s + r.est_effort, 0)
        row[m.name] = Math.round(remain * 10) / 10
      }
      data.push(row)
    }

    return { totalEffort: total, remaining: rem, done: dn, chartData: data, activeMembers: activeMems }
  }, [reqs, members])

  if (reqs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无需求数据</CardContent></Card>
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <CardHeader><CardTitle>每人燃尽(剩余工时趋势)</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <span>总工时 <b>{totalEffort}h</b></span>
          <span>已上线 <b className="text-green-600">{done}h</b></span>
          <span>剩余 <b className="text-orange-600">{remaining}h</b></span>
          <span>完成率 <b>{totalEffort > 0 ? ((done / totalEffort) * 100).toFixed(0) : 0}%</b></span>
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
          <div className="text-sm text-muted-foreground">需求没有计划日期或未分配负责人,无法画趋势。请在编辑需求时填写「计划开始/结束」+ 分配负责人。</div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          每条线 = 一个成员的剩余工时(未到 planned_end 的需求工时之和)。线上升=新需求排进来了;线下降=需求计划完成了。红色竖线=今天。点图例可隐藏/显示某人的线。
        </p>
      </CardContent>
    </Card>
  )
}

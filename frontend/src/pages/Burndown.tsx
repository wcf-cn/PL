import { useEffect, useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { api } from '../api'
import type { Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export default function Burndown() {
  const [reqs, setReqs] = useState<Requirement[]>([])

  useEffect(() => { api.requirements.list().then(setReqs) }, [])

  const { totalEffort, remaining, done, chartData } = useMemo(() => {
    const total = reqs.reduce((s, r) => s + r.est_effort, 0)
    const inFlight = reqs.filter(r => !['done', 'paused'].includes(r.status))
    const rem = inFlight.reduce((s, r) => s + r.est_effort, 0)
    const dn = reqs.filter(r => r.status === 'done').reduce((s, r) => s + r.est_effort, 0)

    // 时间轴:从最早 planned_start 到今天(或最晚 planned_end)
    const dated = reqs.filter(r => r.planned_start)
    if (dated.length === 0) return { totalEffort: total, remaining: rem, done: dn, chartData: [] }

    const minDate = new Date(Math.min(...dated.map(r => new Date(r.planned_start!).getTime())))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const maxDate = new Date(Math.max(today.getTime(), ...dated.map(r => new Date(r.planned_end || r.planned_start!).getTime())))

    // 按天遍历,计算每天的的"计划剩余工时"
    // 某天的计划剩余 = 所有需求的 est_effort 之和,排除:
    //   - 已 planned_end < 该天的(计划已完成)
    //   - paused 的
    const data: Array<{ date: string; planned: number }> = []
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0]
      const plannedRemain = reqs
        .filter(r => r.status !== 'paused' && (!r.planned_end || r.planned_end >= ds))
        .reduce((s, r) => s + r.est_effort, 0)
      data.push({ date: ds, planned: Math.round(plannedRemain * 10) / 10 })
    }

    return { totalEffort: total, remaining: rem, done: dn, chartData: data }
  }, [reqs])

  if (reqs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无需求数据</CardContent></Card>
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <CardHeader><CardTitle>工时燃尽(全部需求)</CardTitle></CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4 text-sm">
          <span>总工时 <b>{totalEffort}h</b></span>
          <span>已上线 <b className="text-green-600">{done}h</b></span>
          <span>剩余 <b className="text-orange-600">{remaining}h</b></span>
          <span>完成率 <b>{totalEffort > 0 ? ((done / totalEffort) * 100).toFixed(0) : 0}%</b></span>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={50} />
              <YAxis label={{ value: '剩余工时(h)', angle: -90, position: 'insideLeft', fontSize: 12 }} tick={{ fontSize: 12 }} />
              <Tooltip labelStyle={{ fontSize: 12 }} />
              <ReferenceLine x={todayStr} stroke="#ff7300" strokeWidth={2} label={{ value: '今天', position: 'top', fill: '#ff7300', fontSize: 11 }} />
              <Area type="monotone" dataKey="planned" name="计划剩余工时" stroke="#8884d8" fill="url(#colorPlanned)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground">需求没有计划日期,无法画时间轴。请在编辑需求时填写「计划开始/结束」。</div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          计划剩余 = 所有未到 planned_end 的需求工时之和(排除暂停)。橙色竖线=今天。
        </p>
      </CardContent>
    </Card>
  )
}

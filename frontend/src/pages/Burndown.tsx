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

  const { chartData, todayDots, activeMembers, totals } = useMemo(() => {
    const inFlight = reqs.filter(r => !['done', 'paused'].includes(r.status))
    const totalEst = inFlight.reduce((s, r) => s + r.est_effort, 0)
    const totalInv = inFlight.reduce((s, r) => s + r.actual_effort, 0)
    const totalRem = Math.max(0, totalEst - totalInv)

    const dated = inFlight.filter(r => r.planned_start && r.planned_end && r.assignee)
    if (dated.length === 0) {
      return { chartData: [], todayDots: [], activeMembers: [], totals: { est: totalEst, inv: totalInv, rem: totalRem } }
    }

    const activeMems = members.filter(m => m.active && dated.some(r => r.assignee === m.id))

    const minDate = new Date(Math.min(...dated.map(r => new Date(r.planned_start!).getTime())))
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    const maxDate = new Date(Math.max(today.getTime(), ...dated.map(r => new Date(r.planned_end!).getTime())))

    // 生成日期序列 + 每人理想线(虚线)
    const data: Array<Record<string, number | string>> = []
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0]
      const row: Record<string, number | string> = { date: ds }
      for (const m of activeMems) {
        const myReqs = dated.filter(r => r.assignee === m.id)
        // 理想线:按 planned_start~end 从 est 匀降到 0
        const idealRemain = myReqs.reduce((s, r) => {
          const start = new Date(r.planned_start!).getTime()
          const end = new Date(r.planned_end!).getTime()
          const now = d.getTime()
          if (now <= start) return s + r.est_effort
          if (now >= end) return s
          const pct = (now - start) / (end - start)
          return s + r.est_effort * (1 - pct)
        }, 0)
        row[`${m.name}_ideal`] = Math.round(idealRemain * 10) / 10

        // 实际线:从 est(planned_start) 到 (est-actual)(今天),之后 null
        if (ds <= todayStr) {
          const myInFlight = inFlight.filter(r => r.assignee === m.id && r.planned_start && r.planned_end)
          if (myInFlight.length === 0) {
            row[`${m.name}_actual`] = null as any
          } else {
            // 找此人最早的 planned_start
            const myStart = Math.min(...myInFlight.map(r => new Date(r.planned_start!).getTime()))
            const myTotal = myInFlight.reduce((s, r) => s + r.est_effort, 0)
            const myActualRemain = myInFlight.reduce((s, r) => s + Math.max(0, r.est_effort - r.actual_effort), 0)
            if (d.getTime() <= myStart) {
              // 开始前:满工时
              row[`${m.name}_actual`] = Math.round(myTotal * 10) / 10
            } else {
              // 开始~今天:从 est 线性到 (est-actual)
              const elapsed = (d.getTime() - myStart) / (today.getTime() - myStart)
              const clamped = Math.max(0, Math.min(1, elapsed))
              row[`${m.name}_actual`] = Math.round((myTotal + (myActualRemain - myTotal) * clamped) * 10) / 10
            }
          }
        } else {
          row[`${m.name}_actual`] = null as any
        }
      }
      data.push(row)
    }

    // 今天的实际剩余(圆点):est - actual
    const dots = activeMems.map((m, i) => {
      const myReqs = inFlight.filter(r => r.assignee === m.id)
      const actualRemain = myReqs.reduce((s, r) => s + Math.max(0, r.est_effort - r.actual_effort), 0)
      return { date: todayStr, value: Math.round(actualRemain * 10) / 10, color: COLORS[i % COLORS.length], name: m.name }
    })

    return { chartData: data, todayDots: dots, activeMembers: activeMems, totals: { est: totalEst, inv: totalInv, rem: totalRem } }
  }, [reqs, members])

  if (reqs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无需求数据</CardContent></Card>
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <CardHeader><CardTitle>工时燃尽(理想 vs 实际)</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <span>在途总工时 <b>{totals.est}h</b></span>
          <span>已投入 <b className="text-green-600">{totals.inv}h</b></span>
          <span>实际剩余 <b className="text-orange-600">{totals.rem}h</b></span>
          <span>完成率 <b>{totals.est > 0 ? ((totals.inv / totals.est) * 100).toFixed(0) : 0}%</b></span>
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
                <>
                  <Line
                    key={`${m.id}_ideal`}
                    type="monotone"
                    dataKey={`${m.name}_ideal`}
                    name={`${m.name}(理想)`}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    key={`${m.id}_actual`}
                    type="monotone"
                    dataKey={`${m.name}_actual`}
                    name={`${m.name}(实际)`}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                  />
                </>
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground">在途需求没有计划日期或未分配负责人。</div>
        )}
        {/* 今天的实际圆点(单独画在下方提示) */}
        {todayDots.length > 0 && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-2">📍 今天实际剩余 vs 理想(按计划应该到)</div>
            <div className="space-y-1">
              {todayDots.map(d => {
                const idealPoint = chartData.find(r => r.date === d.date)?.[`${d.name}_ideal`] as number
                const diff = idealPoint !== undefined ? d.value - idealPoint : 0
                const status = diff > 1 ? '❌ 落后' : diff < -1 ? '✅ 超前' : '🟡 正常'
                return (
                  <div key={d.name} className="text-xs flex items-center gap-3">
                    <span className="w-16 font-medium">{d.name}</span>
                    <span>实际剩余 <b className="text-orange-600">{d.value}h</b></span>
                    <span>理想应到 <b>{idealPoint !== undefined ? `${Math.round(idealPoint)}h` : '—'}</b></span>
                    <span className={diff > 1 ? 'text-red-600 font-medium' : diff < -1 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                      {status}{diff > 1 ? ` (+${Math.round(diff)}h)` : diff < -1 ? ` (${Math.round(diff)}h)` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>📊 虚线 = 理想进度(按 planned_start→end 匀速消耗)</p>
          <p>📊 红线 = 今天。下方对比表:实际剩余 vs 理想应到 = 落后/超前</p>
          <p>📊 不预测未来。实际剩余 = est_effort - actual_effort</p>
        </div>
      </CardContent>
    </Card>
  )
}

import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { api } from '../api'
import type { Requirement, Member, MemberSnapshot } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084fe', '#fab1a0']

export default function Burndown() {
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [snapshots, setSnapshots] = useState<MemberSnapshot[]>([])

  useEffect(() => {
    api.requirements.list().then(setReqs)
    api.members.list().then(setMembers)
    api.snapshots().then(setSnapshots)
  }, [])

  const { chartData, activeMembers, totals, comparison } = useMemo(() => {
    // A1: 只算叶子(无子任务),避免父子 double-count
    const leaves = reqs.filter(r => !reqs.some(c => c.parent === r.id))
    const inFlight = leaves.filter(r => !['done', 'paused'].includes(r.status))
    const totalEst = inFlight.reduce((s, r) => s + r.est_effort, 0)
    const totalInv = inFlight.reduce((s, r) => s + r.actual_effort, 0)
    const totalRem = Math.max(0, totalEst - totalInv)

    const dated = inFlight.filter(r => r.planned_start && r.planned_end && r.assignee)
    const activeMems = members.filter(m => m.active && inFlight.some(r => r.assignee === m.id))

    if (dated.length === 0 && snapshots.length === 0) {
      return { chartData: [], activeMembers: activeMems, totals: { est: totalEst, inv: totalInv, rem: totalRem }, comparison: [] }
    }

    // 理想线日期范围
    const allDates = new Set<string>()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    dated.forEach(r => {
      allDates.add(r.planned_start!)
      if (r.planned_end) allDates.add(r.planned_end!)
    })
    allDates.add(todayStr)
    snapshots.forEach(s => allDates.add(s.date))

    const sortedDates = Array.from(allDates).sort()

    // 构建合并数据:每天的理想线值 + 快照实际值
    const data = sortedDates.map(ds => {
      const row: Record<string, number | string | null> = { date: ds }
      const d = new Date(ds + 'T00:00:00')

      for (const m of activeMems) {
        // 理想线(虚线)
        const myDated = dated.filter(r => r.assignee === m.id)
        if (myDated.length > 0) {
          const idealRemain = myDated.reduce((s, r) => {
            const start = new Date(r.planned_start!).getTime()
            const end = new Date(r.planned_end!).getTime()
            const now = d.getTime()
            if (now <= start) return s + r.est_effort
            if (now >= end) return s
            return s + r.est_effort * (1 - (now - start) / (end - start))
          }, 0)
          row[`${m.name}_ideal`] = Math.round(idealRemain * 10) / 10
        }

        // 实际线(快照)
        const snap = snapshots.find(s => s.member_id === m.id && s.date === ds)
        if (snap) {
          row[m.name] = Math.round(snap.remaining_effort * 10) / 10
        } else {
          row[m.name] = null
        }
      }
      return row
    })

    // 今天的对比(实际 vs 理想)
    const comp = activeMems.map((m, i) => {
      // A2: actual 与 ideal 同口径,都只算有计划日期的(myDated),否则未排期需求导致恒显"落后"
      const myDated = dated.filter(r => r.assignee === m.id)
      const actualRemain = myDated.reduce((s, r) => s + Math.max(0, r.est_effort - r.actual_effort), 0)
      const todayIdeal = data.find(r => r.date === todayStr)
      const idealVal = todayIdeal ? (todayIdeal[`${m.name}_ideal`] as number) : undefined
      const diff = idealVal !== undefined ? actualRemain - idealVal : 0
      return { name: m.name, color: COLORS[i % COLORS.length], actual: Math.round(actualRemain), ideal: idealVal !== undefined ? Math.round(idealVal) : undefined, diff: Math.round(diff) }
    })

    return { chartData: data, activeMembers: activeMems, totals: { est: totalEst, inv: totalInv, rem: totalRem }, comparison: comp }
  }, [reqs, members, snapshots])

  if (reqs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无需求数据</CardContent></Card>
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <CardHeader><CardTitle>工时燃尽(真实快照 vs 理想)</CardTitle></CardHeader>
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
                <div key={m.id}>
                  <Line type="monotone" dataKey={`${m.name}_ideal`} name={`${m.name}(理想)`}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} strokeDasharray="5 5" dot={false} connectNulls />
                  <Line type="monotone" dataKey={m.name} name={`${m.name}(实际)`}
                    stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                </div>
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground">在途需求没有计划日期或未分配负责人。</div>
        )}
        {comparison.length > 0 && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-2">📍 今天:实际剩余 vs 理想应到</div>
            <div className="space-y-1">
              {comparison.map(c => (
                <div key={c.name} className="text-xs flex items-center gap-3">
                  <span className="w-16 font-medium">{c.name}</span>
                  <span>实际 <b className="text-orange-600">{c.actual}h</b></span>
                  <span>理想应到 <b>{c.ideal !== undefined ? `${c.ideal}h` : '—'}</b></span>
                  <span className={c.diff > 1 ? 'text-red-600 font-medium' : c.diff < -1 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                    {c.diff > 1 ? `❌ 落后 +${c.diff}h` : c.diff < -1 ? `✅ 超前 ${c.diff}h` : '🟡 正常'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>📊 虚线 = 理想进度(planned_start→end 匀降);实线 = 真实快照(每天访问时自动记录 est-actual)</p>
          <p>📊 实线 = 每日真实数据点,随着每天访问页面自动积累历史。线越高 = 剩余越多 = 进度慢</p>
          <p>📊 红线 = 今天。点越多历史越长(需要每天打开燃尽页一次,自动记录)</p>
        </div>
      </CardContent>
    </Card>
  )
}

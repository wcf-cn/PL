import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import type { Requirement, Member } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

const COLORS = { est: '#8884d8', invested: '#82ca9d', remaining: '#ffc658' }

export default function Burndown() {
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    api.requirements.list().then(setReqs)
    api.members.list().then(setMembers)
  }, [])

  const { chartData, totals } = useMemo(() => {
    const inFlight = reqs.filter(r => !['done', 'paused'].includes(r.status))
    const activeMems = members.filter(m => m.active && inFlight.some(r => r.assignee === m.id))

    const data = activeMems.map(m => {
      const myReqs = inFlight.filter(r => r.assignee === m.id)
      const est = myReqs.reduce((s, r) => s + r.est_effort, 0)
      const invested = myReqs.reduce((s, r) => s + r.actual_effort, 0)
      const remaining = Math.max(0, est - invested)
      return { name: m.name, 预计: Math.round(est), 已投入: Math.round(invested), 剩余: Math.round(remaining) }
    })

    const totalEst = data.reduce((s, d) => s + d.预计, 0)
    const totalInv = data.reduce((s, d) => s + d.已投入, 0)
    const totalRem = data.reduce((s, d) => s + d.剩余, 0)

    return { chartData: data, totals: { est: totalEst, inv: totalInv, rem: totalRem } }
  }, [reqs, members])

  if (reqs.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">暂无需求数据</CardContent></Card>
  }

  return (
    <Card>
      <CardHeader><CardTitle>工时总览(每人实际进度)</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <span>在途总工时 <b>{totals.est}h</b></span>
          <span>已投入 <b className="text-green-600">{totals.inv}h</b></span>
          <span>剩余 <b className="text-orange-600">{totals.rem}h</b></span>
          <span>完成率 <b>{totals.est > 0 ? ((totals.inv / totals.est) * 100).toFixed(0) : 0}%</b></span>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis label={{ value: '工时(h)', angle: -90, position: 'insideLeft', fontSize: 12 }} tick={{ fontSize: 12 }} />
              <Tooltip labelStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="预计" fill={COLORS.est} radius={[4, 4, 0, 0]} />
              <Bar dataKey="已投入" fill={COLORS.invested} radius={[4, 4, 0, 0]} />
              <Bar dataKey="剩余" fill={COLORS.remaining} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground">没有在途需求(或需求未分配负责人)。</div>
        )}
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>📊 每人 3 根柱:紫=预计总工时,绿=已投入,黄=剩余(预计-已投入)</p>
          <p>📊 绿柱越接近紫柱 = 进度越好;黄柱高 = 还有不少活要做</p>
          <p>📊 只统计在途需求(排除已上线/暂停)。已投入 = actual_effort,在编辑需求里填</p>
        </div>
      </CardContent>
    </Card>
  )
}

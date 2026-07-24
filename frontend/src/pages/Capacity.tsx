import { useEffect, useState, useMemo } from 'react'
import { api } from '../api'
import type { Member, Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'

// D6: 名义产能折算为实际可用产能(扣会议/CR/支援/面试等非项目时间)。可调。
const PRODUCTIVITY_FACTOR = 0.7

function daysBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

export default function Capacity() {
  const [members, setMembers] = useState<Member[]>([])
  const [reqs, setReqs] = useState<Requirement[]>([])

  useEffect(() => {
    api.members.list().then(setMembers)
    api.requirements.list().then(setReqs)
  }, [])

  const rows = useMemo(() => {
    // 本周(周一~周日):"本周负载"按周与 planned 区间是否重叠计算(避免"今天不在区间"时显示 0%)
    const _today = new Date(); _today.setHours(0, 0, 0, 0)
    const weekStart = new Date(_today)
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1))
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6)
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]
    // A1: 只算叶子(无子任务)
    const leaves = reqs.filter(r => !reqs.some(c => c.parent === r.id))
    return members.filter(m => m.active).map(m => {
      const myReqs = leaves.filter(r => r.assignee === m.id && !['done', 'paused'].includes(r.status))
      // 有计划日期的:按天分摊
      const scheduled = myReqs.filter(r => r.planned_start && r.planned_end)
      const unscheduled = myReqs.filter(r => !r.planned_start || !r.planned_end)

      // 本周负载:按本周(weekStart~weekEnd)与 planned 区间的【实际重叠天数】精确累加 daily×overlapDays
      const todayLoad = scheduled
        .filter(r => r.planned_start! <= weekEndStr && r.planned_end! >= weekStartStr)
        .reduce((s, r) => {
          const daily = r.est_effort / daysBetween(r.planned_start!, r.planned_end!)
          const ovStart = Math.max(new Date(r.planned_start!).getTime(), weekStart.getTime())
          const ovEnd = Math.min(new Date(r.planned_end!).getTime(), weekEnd.getTime())
          const overlapDays = Math.max(0, Math.round((ovEnd - ovStart) / 86400000) + 1) // 含首尾
          return s + daily * overlapDays
        }, 0)

      // 峰值周负载:遍历所有日期,找最大的日负载×5(工作日)
      const dailyLoads: Record<string, number> = {}
      scheduled.forEach(r => {
        const days = daysBetween(r.planned_start!, r.planned_end!)
        const daily = r.est_effort / days
        const start = new Date(r.planned_start!)
        const end = new Date(r.planned_end!)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const key = d.toISOString().split('T')[0]
          dailyLoads[key] = (dailyLoads[key] || 0) + daily
        }
      })
      const peakDaily = Object.values(dailyLoads).reduce((max, v) => Math.max(max, v), 0)
      const peakWeekly = peakDaily * 5

      const unscheduledTotal = unscheduled.reduce((s, r) => s + r.est_effort, 0)
      const currentWeekly = todayLoad
      const cap = m.week_capacity
      // D6: 实际可用 = 名义 × 折算系数,让 >100% 在真实负载下触发
      const effectiveCap = cap * PRODUCTIVITY_FACTOR

      return {
        member_id: m.id, member: m.name, capacity: cap,
        currentWeekly: Math.round(currentWeekly),
        peakWeekly: Math.round(peakWeekly),
        unscheduled: Math.round(unscheduledTotal),
        utilization: effectiveCap > 0 ? currentWeekly / effectiveCap : 0,
        peakUtil: effectiveCap > 0 ? peakWeekly / effectiveCap : 0,
      }
    }).sort((a, b) => b.peakUtil - a.peakUtil)
  }, [members, reqs])

  function badge(u: number) {
    if (u > 1) return <Badge variant="destructive">{(u * 100).toFixed(0)}%</Badge>
    if (u >= 0.8) return <Badge variant="secondary">{(u * 100).toFixed(0)}%</Badge>
    return <Badge>{(u * 100).toFixed(0)}%</Badge>
  }

  return (
    <Card>
      <CardHeader><CardTitle>产能分析</CardTitle></CardHeader>
      <CardContent>
        {/* 电脑:Table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader><TableRow>
              <TableHead>成员</TableHead>
              <TableHead>周容量(h)</TableHead>
              <TableHead>本周负载(h)</TableHead>
              <TableHead>峰值周(h)</TableHead>
              <TableHead>未排期(h)</TableHead>
              <TableHead>本周利用率</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.member_id}>
                  <TableCell className="font-medium">{r.member}</TableCell>
                  <TableCell>{r.capacity}</TableCell>
                  <TableCell>{r.currentWeekly}</TableCell>
                  <TableCell className={r.peakUtil > 1 ? 'text-red-600 font-medium' : ''}>{r.peakWeekly}</TableCell>
                  <TableCell className="text-muted-foreground">{r.unscheduled}</TableCell>
                  <TableCell>{badge(r.utilization)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* 手机:卡片 */}
        <div className="md:hidden space-y-2">
          {rows.map(r => (
            <div key={r.member_id} className="border rounded-lg p-3 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-medium">{r.member}</span>
                {badge(r.utilization)}
              </div>
              <div className="text-xs text-muted-foreground">
                容量{r.capacity}h · 本周{r.currentWeekly}h · 峰值{r.peakWeekly}h · 未排期{r.unscheduled}h
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          <p>📊 <b>本周负载</b>:今天在 planned_start~end 范围内的需求,工时按天分摊后 ×5(工作日)</p>
          <p>📊 <b>峰值周</b>:所有日期中日负载最高的 ×5。红色=超容量</p>
          <p>📊 <b>未排期</b>:在途但没填计划日期的需求工时合计(不参与负载计算)</p>
          <p>绿色 &lt;80% · 黄色 80–100% · 红色 &gt;100%(利用率按实际可用产能 = 名义 × {PRODUCTIVITY_FACTOR} 折算)</p>
        </div>
      </CardContent>
    </Card>
  )
}

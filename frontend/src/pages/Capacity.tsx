import { useEffect, useState, useMemo } from 'react'
import { api } from '../api'
import type { Member, Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'

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
    const today = new Date().toISOString().split('T')[0]
    return members.filter(m => m.active).map(m => {
      const myReqs = reqs.filter(r => r.assignee === m.id && !['done', 'paused'].includes(r.status))
      // 有计划日期的:按天分摊
      const scheduled = myReqs.filter(r => r.planned_start && r.planned_end)
      const unscheduled = myReqs.filter(r => !r.planned_start || !r.planned_end)

      // 当前周负载:今天在 planned_start~planned_end 内的,取 est_effort/duration
      const todayLoad = scheduled
        .filter(r => r.planned_start! <= today && r.planned_end! >= today)
        .reduce((s, r) => s + r.est_effort / daysBetween(r.planned_start!, r.planned_end!), 0)

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
      const currentWeekly = todayLoad * 5
      const cap = m.week_capacity

      return {
        member_id: m.id, member: m.name, capacity: cap,
        currentWeekly: Math.round(currentWeekly),
        peakWeekly: Math.round(peakWeekly),
        unscheduled: Math.round(unscheduledTotal),
        utilization: cap > 0 ? currentWeekly / cap : 0,
        peakUtil: cap > 0 ? peakWeekly / cap : 0,
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
        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          <p>📊 <b>本周负载</b>:今天在 planned_start~end 范围内的需求,工时按天分摊后 ×5(工作日)</p>
          <p>📊 <b>峰值周</b>:所有日期中日负载最高的 ×5。红色=超容量</p>
          <p>📊 <b>未排期</b>:在途但没填计划日期的需求工时合计(不参与负载计算)</p>
          <p>绿色 &lt;80% · 黄色 80–100% · 红色 &gt;100%</p>
        </div>
      </CardContent>
    </Card>
  )
}

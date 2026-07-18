import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Member, Requirement, CapacityRow } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'

function utilizationBadge(u: number) {
  if (u > 1) return <Badge variant="destructive">{(u * 100).toFixed(0)}%</Badge>
  if (u >= 0.8) return <Badge variant="secondary">{(u * 100).toFixed(0)}%</Badge>
  return <Badge>{(u * 100).toFixed(0)}%</Badge>
}

export default function Capacity() {
  const [members, setMembers] = useState<Member[]>([])
  const [reqs, setReqs] = useState<Requirement[]>([])

  useEffect(() => {
    api.members.list().then(setMembers)
    api.requirements.list().then(setReqs)
  }, [])

  const inFlight = reqs.filter(r => !['done', 'paused'].includes(r.status))
  const rows: CapacityRow[] = members.filter(m => m.active).map(m => {
    const load = inFlight.filter(r => r.assignee === m.id).reduce((sum, r) => sum + r.est_effort, 0)
    const capacity = m.week_capacity
    return { member_id: m.id, member: m.name, capacity, load, utilization: capacity > 0 ? load / capacity : 0 }
  }).sort((a, b) => b.utilization - a.utilization)

  const totalCap = rows.reduce((s, r) => s + r.capacity, 0)
  const totalLoad = rows.reduce((s, r) => s + r.load, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>产能分析(全部)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4 text-sm">
          <span>总容量 <b>{totalCap}h</b></span>
          <span>总占用 <b>{totalLoad}h</b></span>
          <span>总利用率 <b>{totalCap > 0 ? ((totalLoad / totalCap) * 100).toFixed(0) : 0}%</b></span>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>成员</TableHead>
            <TableHead>周容量(h)</TableHead>
            <TableHead>在途占用(h)</TableHead>
            <TableHead>利用率(周)</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.member_id}>
                <TableCell className="font-medium">{r.member}</TableCell>
                <TableCell>{r.capacity}</TableCell>
                <TableCell>{r.load}</TableCell>
                <TableCell>{utilizationBadge(r.utilization)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-4">
          绿色 &lt;80% · 黄色 80–100% · 红色 &gt;100%。利用率为在途需求工时÷周容量(表示几周的工作量)。
        </p>
      </CardContent>
    </Card>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Sprint, CapacityRow } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'

function utilizationBadge(u: number) {
  if (u > 1) return <Badge variant="destructive">{(u * 100).toFixed(1)}%</Badge>
  if (u >= 0.8) return <Badge variant="secondary">{(u * 100).toFixed(1)}%</Badge>
  return <Badge variant="default">{(u * 100).toFixed(1)}%</Badge>
}

export default function Capacity() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sid, setSid] = useState<number | ''>('')
  const [rows, setRows] = useState<CapacityRow[]>([])
  useEffect(() => { api.sprints.list().then(s => { setSprints(s); const a = s.find(x=>x.is_active); setSid(a?a.id:s[0]?.id??'') }) }, [])
  useEffect(() => { if (sid) api.capacity(Number(sid)).then(setRows) }, [sid])
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>产能分析</CardTitle>
          <Select value={sid?.toString() || ''} onValueChange={(v) => setSid(v ? Number(v) : '')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择迭代" />
            </SelectTrigger>
            <SelectContent>
              {sprints.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>成员</TableHead>
              <TableHead>容量(h)</TableHead>
              <TableHead>占用(h)</TableHead>
              <TableHead>利用率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.member_id}>
                <TableCell>{r.member}</TableCell>
                <TableCell>{r.capacity}</TableCell>
                <TableCell>{r.load}</TableCell>
                <TableCell>{utilizationBadge(r.utilization)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-4">
          绿色 &lt;80% · 黄色 80–100% · 红色 &gt;100% 超载。已按利用率降序(后端排序)。
        </p>
      </CardContent>
    </Card>
  )
}

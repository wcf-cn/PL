import { useEffect, useState, useMemo } from 'react'
import { api } from '../api'
import type { Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'

function agg(rows: Requirement[], keyFn: (r: Requirement) => string) {
  const groups: Record<string, Requirement[]> = {}
  rows.forEach(r => { const k = keyFn(r) || '未分组'; (groups[k] = groups[k] || []).push(r) })
  return Object.entries(groups).map(([k, rs]) => ({
    key: k,
    count: rs.length,
    est: rs.reduce((s, r) => s + r.est_effort, 0),
    actual: rs.reduce((s, r) => s + r.actual_effort, 0),
  })).sort((a, b) => b.actual - a.actual)
}

export default function Estimation() {
  const [reqs, setReqs] = useState<Requirement[]>([])
  useEffect(() => { api.requirements.list().then(setReqs) }, [])

  const { byMember, byModule } = useMemo(() => {
    const done = reqs.filter(r => r.status === 'done' && !reqs.some(c => c.parent === r.id))
    return { byMember: agg(done, r => r.assignee_name || '未分配'), byModule: agg(done, r => r.module) }
  }, [reqs])

  function Table_(title: string, rows: ReturnType<typeof agg>) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <div className="text-sm text-muted-foreground">暂无已完成需求数据</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>分组</TableHead><TableHead>#done</TableHead>
                <TableHead>Σ预计h</TableHead><TableHead>Σ实际h</TableHead><TableHead>偏差</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(r => {
                  const ratio = r.est > 0 ? r.actual / r.est : 0
                  const pct = Math.round(ratio * 100)
                  return (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.key}</TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell>{r.est}</TableCell>
                      <TableCell>{r.actual}</TableCell>
                      <TableCell>
                        <Badge variant={ratio > 1.2 ? 'destructive' : ratio < 0.9 ? 'secondary' : 'default'}>
                          {pct}%{ratio > 1.2 ? ' 低估' : ratio < 0.9 ? ' 高估' : ' 准'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>估时偏差</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">仅统计已上线需求(叶子)。偏差 = Σ实际 / Σ预计。&gt;120% = 低估,&lt;90% = 高估。帮你校准估时直觉。</CardContent></Card>
      <div className="grid md:grid-cols-2 gap-4">
        {Table_('按成员', byMember)}
        {Table_('按模块', byModule)}
      </div>
    </div>
  )
}

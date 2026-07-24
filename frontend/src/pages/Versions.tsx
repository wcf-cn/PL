import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Version, Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

const PHASE_DATES: Array<[keyof Version, string]> = [
  ['integration_date', '联调'],
  ['freeze_date', '封板'],
  ['test_date', '转测'],
  ['release_date', '发布'],
]

function phaseVariant(p: string) {
  if (p === '已发布') return 'secondary' as const
  if (p === '规划中') return 'outline' as const
  return 'default' as const
}

export default function Versions() {
  const [versions, setVersions] = useState<Version[]>([])
  const [reqs, setReqs] = useState<Requirement[]>([])

  useEffect(() => {
    api.versions.list().then(setVersions)
    api.requirements.list().then(setReqs)
  }, [])

  return (
    <Card>
      <CardHeader><CardTitle>版本管理</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {versions.length === 0 && <div className="text-sm text-muted-foreground">暂无版本</div>}
        {versions.map(v => {
          const leaves = reqs.filter(r => r.version === v.id && !reqs.some(c => c.parent === r.id))
          const total = leaves.length
          const done = leaves.filter(r => r.status === 'done').length
          const pct = total > 0 ? Math.round(done / total * 100) : 0
          const remaining = leaves.filter(r => !['done', 'paused'].includes(r.status))
            .reduce((s, r) => s + Math.max(0, r.est_effort - r.actual_effort), 0)
          return (
            <Card key={v.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{v.name}</span>
                  <Badge variant={phaseVariant(v.current_phase)}>{v.current_phase}</Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {PHASE_DATES.map(([k, label]) => (
                    <span key={k}>{label}: <b className="text-foreground">{(v[k] as string) || '—'}</b></span>
                  ))}
                </div>
                <div className="text-xs">
                  进度 <b>{done}/{total}</b> · <b>{pct}%</b> · 剩余 <b>{remaining}h</b>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </CardContent>
    </Card>
  )
}

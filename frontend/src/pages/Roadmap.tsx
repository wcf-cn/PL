import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Version, Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

const PHASE_KEYS: Array<[keyof Version, string, string]> = [
  ['dev_start_date', '投入', '#64748b'],
  ['integration_date', '联调', '#3b82f6'],
  ['freeze_date', '封板', '#f59e0b'],
  ['test_date', '转测', '#a855f7'],
  ['release_date', '发布', '#ef4444'],
]

function parse(d: string | null) { return d ? new Date(d).getTime() : null }

export default function Roadmap() {
  const [versions, setVersions] = useState<Version[]>([])
  const [reqs, setReqs] = useState<Requirement[]>([])
  useEffect(() => { api.versions.list().then(setVersions); api.requirements.list().then(setReqs) }, [])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayT = today.getTime()
  const allTimes = versions.flatMap(v => PHASE_KEYS.map(([k]) => parse(v[k] as string | null))).filter((x): x is number => x !== null)
  allTimes.push(todayT)
  const minT = allTimes.length ? Math.min(...allTimes) : 0
  const maxT = allTimes.length ? Math.max(...allTimes) : 1
  const span = Math.max(1, maxT - minT)
  const pctOf = (t: number) => Math.max(0, Math.min(100, ((t - minT) / span) * 100))

  const dated = versions.filter(v => PHASE_KEYS.some(([k]) => parse(v[k] as string | null)))
  const undated = versions.filter(v => !PHASE_KEYS.some(([k]) => parse(v[k] as string | null)))

  const stats = (v: Version) => {
    const leaves = reqs.filter(r => r.version === v.id && !reqs.some(c => c.parent === r.id))
    const done = leaves.filter(r => r.status === 'done').length
    return { total: leaves.length, done, pct: leaves.length ? Math.round(done / leaves.length * 100) : 0 }
  }

  return (
    <Card>
      <CardHeader><CardTitle>路线图</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {versions.length === 0 && <div className="text-sm text-muted-foreground">暂无版本</div>}
        {dated.map(v => {
          const s = stats(v)
          const starts = PHASE_KEYS.map(([k]) => parse(v[k] as string | null)).filter((x): x is number => x !== null)
          const left = pctOf(Math.min(...starts))
          const width = Math.max(4, pctOf(Math.max(...starts)) - left)
          return (
            <div key={v.id} className="flex items-center gap-2">
              <div className="w-24 shrink-0">
                <div className="text-sm font-medium truncate">{v.name}</div>
                <div className="text-[10px] text-muted-foreground">{s.done}/{s.total} · {s.pct}%</div>
              </div>
              <div className="relative flex-1 h-8 bg-muted/40 rounded">
                {/* 今天竖线 */}
                <div className="absolute top-0 bottom-0 border-l-2 border-red-500/60" style={{ left: `${pctOf(todayT)}%` }} title="今天" />
                {/* 版本区间条 */}
                <div className="absolute top-1 bottom-1 rounded bg-primary/20 border border-primary/40 flex items-center justify-center"
                     style={{ left: `${left}%`, width: `${width}%` }}>
                  <span className="text-[10px] text-muted-foreground truncate px-1">{v.current_phase}</span>
                </div>
                {/* 阶段标记点 */}
                {PHASE_KEYS.map(([k, label, color]) => {
                  const t = parse(v[k] as string | null)
                  if (t == null) return null
                  return <div key={k} className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-background z-10" style={{ left: `calc(${pctOf(t)}% - 5px)`, background: color }} title={`${label} ${v[k]}`} />
                })}
              </div>
            </div>
          )
        })}

        {/* 图例 */}
        {dated.length > 0 && (
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-1">
            {PHASE_KEYS.map(([k, label, color]) => (
              <span key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{label}</span>
            ))}
            <span className="flex items-center gap-1"><span className="w-0 h-3 border-l-2 border-red-500/60" />今天</span>
          </div>
        )}

        {/* 未排期版本 */}
        {undated.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-1">未排期</div>
            <div className="flex flex-wrap gap-2">
              {undated.map(v => {
                const s = stats(v)
                return <Badge key={v.id} variant="outline" className="text-xs">{v.name} · {v.current_phase} · {s.done}/{s.total}</Badge>
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

import { useEffect, useState, useMemo } from 'react'
import { api } from '../api'
import type { Requirement, Member, Version } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

const PRODUCTIVITY_FACTOR = 0.7 // 与 Capacity.tsx 一致;实际可用产能

function Section({ title, items, color }:{ title:string; items:{id:number|string;text:string;sub?:string}[]; color:string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><span>{color}</span>{title}<Badge variant="secondary">{items.length}</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 && <div className="text-sm text-muted-foreground">无</div>}
        {items.map(it => (
          <div key={it.id} className="text-sm">
            <span className="font-medium">{it.text}</span>
            {it.sub && <span className="text-muted-foreground ml-2 text-xs">{it.sub}</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function Focus() {
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [versions, setVersions] = useState<Version[]>([])

  useEffect(() => {
    api.requirements.list().then(setReqs)
    api.members.list().then(setMembers)
    api.versions.list().then(setVersions)
  }, [])

  const { overdue, upcoming, blocked, versionRisks, overloaded } = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    const leaves = reqs.filter(r => !reqs.some(c => c.parent === r.id))
    const active = (r: Requirement) => !['done','paused'].includes(r.status)
    const overdue = leaves.filter(r => r.planned_end && active(r) && new Date(r.planned_end) < today)
      .map(r => ({ id:r.id, text:r.title, sub:`${r.assignee_name||'未分配'} · 应完成 ${r.planned_end}` }))
    const upcoming = leaves.filter(r => {
      if (!r.planned_end || !active(r)) return false
      const d = Math.round((new Date(r.planned_end).getTime() - today.getTime()) / 86400000)
      return d >= 0 && d <= 2
    }).map(r => ({ id:r.id, text:r.title, sub:`${r.assignee_name||'未分配'} · ${r.planned_end}` }))
    const blocked = leaves.filter(r => r.blocked_by.length > 0 || r.status === 'blocked')
      .map(r => ({ id:r.id, text:r.title, sub:`${r.assignee_name||'未分配'}${r.blocked_by.length ? ` · 被${r.blocked_by.length}项阻塞` : ''}` }))
    const versionRisks: {id:number|string;text:string;sub?:string}[] = []
    versions.forEach(v => {
      const vLeaves = reqs.filter(r => r.version === v.id && !reqs.some(c => c.parent === r.id))
      const unfinished = vLeaves.filter(r => !['done','paused'].includes(r.status)).length
      ;([['freeze_date','封板'],['test_date','转测']] as const).forEach(([k, label]) => {
        const d = v[k] as string | null
        if (!d) return
        const diff = Math.round((new Date(d).getTime() - today.getTime()) / 86400000)
        if (diff <= 3) versionRisks.push({ id:`${v.id}-${k}`, text:`${v.name} ${label}`, sub:`${d}${unfinished ? ` · ${unfinished}项未完成` : ''}` })
      })
    })
    const overloaded = members.filter(m => m.active).map(m => {
      const load = reqs.filter(r => r.assignee === m.id && !['done','paused'].includes(r.status) && !reqs.some(c => c.parent === r.id))
        .reduce((s, r) => s + r.est_effort, 0)
      const cap = m.week_capacity * PRODUCTIVITY_FACTOR
      return { m, load, cap }
    }).filter(x => x.cap > 0 && x.load > x.cap)
      .map(x => ({ id:x.m.id, text:x.m.name, sub:`${x.load}h > 可用${Math.round(x.cap)}h` }))
    return { overdue, upcoming, blocked, versionRisks, overloaded }
  }, [reqs, members, versions])

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>风险驾驶舱</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">一屏看到需要先处理的问题。各分区为空即无该类风险。</CardContent></Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="超期" color="🔴" items={overdue} />
        <Section title="将至(2天内)" color="🟡" items={upcoming} />
        <Section title="被阻塞" color="🔒" items={blocked} />
        <Section title="版本风险(3天内封板/转测)" color="🏷️" items={versionRisks} />
        <Section title="超载成员" color="⚠️" items={overloaded} />
      </div>
    </div>
  )
}

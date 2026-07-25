import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Member, Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { STATUS_LABEL } from '../types'

export default function Schedule() {
  const [members, setMembers] = useState<Member[]>([])
  const [reqs, setReqs] = useState<Requirement[]>([])

  useEffect(() => {
    api.members.list().then(setMembers)
    api.requirements.list().then(setReqs)
  }, [])

  const activeMembers = members.filter(m => m.active)
  const inFlight = reqs.filter(r => !['done', 'paused'].includes(r.status))

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>排期(全部在途需求)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {activeMembers.map(m => {
            const memberReqs = inFlight.filter(r => r.assignee === m.id)
            const totalEffort = memberReqs.reduce((s, r) => s + r.est_effort, 0)
            const remaining = memberReqs.reduce((s, r) => s + Math.max(0, r.est_effort - r.actual_effort), 0)
            return (
              <Card key={m.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{m.name}</CardTitle>
                    <Badge variant="secondary">{memberReqs.length} 个需求 · 在途 {totalEffort}h · 剩余 {remaining}h</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {memberReqs.length === 0 ? (
                    <div className="text-sm text-muted-foreground">暂无在途需求</div>
                  ) : (
                    <div className="space-y-2">
                      {memberReqs.map(r => (
                        <div key={r.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="shrink-0">{STATUS_LABEL[r.status]}</Badge>
                            <span className="font-medium truncate">{r.title}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span>{r.est_effort}h</span>
                            {(r.planned_start || r.planned_end) && (
                              <span>{r.planned_start || '?'} ~ {r.planned_end || '?'}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

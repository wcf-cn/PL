import { useEffect, useState } from 'react'
import { api } from '../api'
import { STATUS_LABEL, type Member, type Sprint, type Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'

export default function Schedule() {
  const [members, setMembers] = useState<Member[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [selectedSprint, setSelectedSprint] = useState<number | null>(null)

  useEffect(() => {
    const loadData = async () => {
      const [membersData, sprintsData, reqsData] = await Promise.all([
        api.members.list(),
        api.sprints.list(),
        api.requirements.list()
      ])
      setMembers(membersData)
      setSprints(sprintsData)
      setRequirements(reqsData)

      // Default to active sprint
      const activeSprint = sprintsData.find(s => s.is_active)
      if (activeSprint) {
        setSelectedSprint(activeSprint.id)
      }
    }
    loadData()
  }, [])

  const activeMembers = members.filter(m => m.active)
  const sprintReqs = requirements.filter(r => r.assigned_sprint === selectedSprint)

  return (
    <Card className="p-6 space-y-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>排期</CardTitle>
          <Select
            value={selectedSprint?.toString() || ''}
            onValueChange={(v) => setSelectedSprint(v ? Number(v) : null)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择迭代" />
            </SelectTrigger>
            <SelectContent>
              {sprints.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name} {s.is_active ? '(当前)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      {!selectedSprint && (
        <CardContent className="text-sm text-muted-foreground">
          请选择一个迭代查看排期
        </CardContent>
      )}

      {selectedSprint && (
        <CardContent className="space-y-4">
          {activeMembers.map(member => {
            const memberReqs = sprintReqs.filter(r => r.assignee === member.id)
            const totalLoad = memberReqs.reduce((sum, r) => sum + r.est_effort, 0)

            if (memberReqs.length === 0) return null

            return (
              <Card key={member.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{member.name}</CardTitle>
                    <Badge variant="secondary">总工时: {totalLoad}h</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {memberReqs.map(req => (
                    <div key={req.id} className="flex items-center gap-3 text-sm p-3 border rounded-lg">
                      <span className="flex-1 font-medium">{req.title}</span>
                      <Badge variant="secondary">{STATUS_LABEL[req.status]}</Badge>
                      <span className="text-muted-foreground">
                        预计 {req.est_effort}h / 已投 {req.actual_effort}h
                      </span>
                      {(req.planned_start || req.planned_end) && (
                        <span className="text-xs text-muted-foreground">
                          {req.planned_start || '?'} ~ {req.planned_end || '?'}
                        </span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}

          {activeMembers.every(m => sprintReqs.filter(r => r.assignee === m.id).length === 0) && (
            <div className="text-sm text-muted-foreground">该迭代无需求</div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

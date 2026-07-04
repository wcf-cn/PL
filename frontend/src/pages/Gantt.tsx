import { useEffect, useState } from 'react'
import { api } from '../api'
import { STATUS_LABEL, type Sprint, type Requirement, type Status } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'

const STATUS_COLORS: Record<Status, string> = {
  backlog: 'bg-gray-300',
  scheduled: 'bg-blue-300',
  in_progress: 'bg-yellow-300',
  testing: 'bg-purple-300',
  done: 'bg-green-300',
  blocked: 'bg-red-300',
  paused: 'bg-gray-400'
}

export default function Gantt() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sid, setSid] = useState<number | ''>('')
  const [reqs, setReqs] = useState<Requirement[]>([])

  useEffect(() => {
    api.sprints.list().then(s => {
      setSprints(s)
      const active = s.find(x => x.is_active)
      setSid(active ? active.id : s[0]?.id ?? '')
    })
  }, [])

  useEffect(() => {
    if (sid) api.requirements.list({ assigned_sprint: String(sid) }).then(setReqs)
  }, [sid])

  const validReqs = reqs.filter(r => r.planned_start && r.planned_end)
  if (!validReqs.length) return <Card className="p-6"><CardContent className="text-sm text-muted-foreground">该迭代无计划日期的需求</CardContent></Card>

  // Parse dates consistently at midnight local time
  const parseDate = (d: string) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
  const dates = validReqs.flatMap(r => [parseDate(r.planned_start!), parseDate(r.planned_end!)])
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))

  const position = (dateStr: string) => {
    const date = parseDate(dateStr)
    return ((date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100
  }

  const width = (start: string, end: string) => position(end) - position(start)

  const formatDate = (date: Date) => date.toISOString().split('T')[0]

  const dateAxis = Array.from({ length: totalDays + 1 }, (_, i) => {
    const d = new Date(minDate)
    d.setDate(d.getDate() + i)
    return d
  })

  // Group requirements by assignee
  const groupedByAssignee = validReqs.reduce((acc, req) => {
    const assigneeName = req.assignee_name || '未分配'
    if (!acc[assigneeName]) {
      acc[assigneeName] = []
    }
    acc[assigneeName].push(req)
    return acc
  }, {} as Record<string, Requirement[]>)

  const assigneeNames = Object.keys(groupedByAssignee)

  return (
    <Card className="p-6 space-y-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>甘特图</CardTitle>
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
      <CardContent className="space-y-4">
        {/* Status Legend */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-muted-foreground">状态:</span>
          {(Object.keys(STATUS_COLORS) as Status[]).map(status => (
            <div key={status} className="flex items-center gap-1">
              <div className={cn("w-3 h-3 rounded", STATUS_COLORS[status])} />
              <span>{STATUS_LABEL[status]}</span>
            </div>
          ))}
        </div>

        <div className="relative border-l border-r border-b rounded-lg overflow-x-auto bg-muted/30">
          <div className="flex border-b text-xs">
            {dateAxis.map(d => (
              <div key={d.toISOString()} className="flex-shrink-0 p-1 text-muted-foreground" style={{ width: `${100 / (totalDays + 1)}%` }}>
                {formatDate(d)}
              </div>
            ))}
          </div>
          {assigneeNames.map(assigneeName => (
            <div key={assigneeName}>
              <div className="bg-muted/50 px-2 py-1 text-sm font-bold border-b flex items-center gap-2">
                {assigneeName}
                <Badge variant="secondary" className="text-xs">{groupedByAssignee[assigneeName].length}</Badge>
              </div>
              {groupedByAssignee[assigneeName].map(r => (
                <div key={r.id} className="relative h-8 border-b">
                  <div
                    className={cn(
                      "absolute h-6 rounded px-2 text-xs flex items-center truncate",
                      STATUS_COLORS[r.status]
                    )}
                    style={{
                      left: `${position(r.planned_start!)}%`,
                      width: `${width(r.planned_start!, r.planned_end!)}%`,
                      top: '4px'
                    }}
                    title={`${r.title} (${STATUS_LABEL[r.status]})`}
                  >
                    {r.title}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

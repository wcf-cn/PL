import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Sprint, Requirement, Status } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
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
  if (!validReqs.length) return <Card><CardContent className="p-6">该冲刺无计划日期的需求</CardContent></Card>

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
    <Card>
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
      <CardContent>
        <div className="relative border-l border-r border-b rounded-lg overflow-x-auto bg-muted/30">
          <div className="flex border-b text-xs">
            {dateAxis.map(d => (
              <div key={d.toISOString()} className="flex-shrink-0 p-1" style={{ width: `${100 / (totalDays + 1)}%` }}>
                {formatDate(d)}
              </div>
            ))}
          </div>
          {assigneeNames.map(assigneeName => (
            <div key={assigneeName}>
              <div className="bg-muted/50 px-2 py-1 text-sm font-medium border-b">
                {assigneeName}
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
                    title={r.title}
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

import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Sprint, Requirement, Status } from '../types'

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
  if (!validReqs.length) return <div>该冲刺无计划日期的需求</div>

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

  return (
    <div>
      <select className="border p-2 mb-3" value={sid} onChange={e => setSid(Number(e.target.value))}>
        {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <div className="relative border-l border-r border-b border-gray-300 bg-white">
        <div className="flex border-b border-gray-300 text-xs">
          {dateAxis.map(d => (
            <div key={d.toISOString()} className="flex-shrink-0" style={{ width: `${100 / (totalDays + 1)}%` }}>
              {formatDate(d)}
            </div>
          ))}
        </div>
        {validReqs.map((r, i) => (
          <div key={r.id} className="relative h-8 border-b border-gray-200" style={{ top: `${i * 32}px` }}>
            <div
              className={`absolute h-6 ${STATUS_COLORS[r.status]} text-xs truncate px-1`}
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
    </div>
  )
}

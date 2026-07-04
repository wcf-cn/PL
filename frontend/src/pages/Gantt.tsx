import { useEffect, useState, useRef } from 'react'
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

// Fixed day width for consistent timeline rendering
const DAY_W = 44

// Collapse constants
const HEAD = 7
const TAIL = 7

export default function Gantt() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sid, setSid] = useState<number | ''>('')
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [dragging, setDragging] = useState<{id: number, origStart: string, origEnd: string, newStart: string, newEnd: string} | null>(null)
  const [axisExpanded, setAxisExpanded] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)

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
    return Math.floor((date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  const width = (start: string, end: string) => {
    const startDays = position(start)
    const endDays = position(end)
    return (endDays - startDays) * DAY_W
  }

  // Display coordinate functions for collapsed mode
  const isCollapsed = !axisExpanded && totalDays > 21

  const formatDate = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`

  // Date helper: add N days to YYYY-MM-DD string, returning new YYYY-MM-DD at local midnight
  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0) // normalize to midnight local to avoid TZ off-by-one
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

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

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent, req: Requirement) => {
    const timeline = timelineRef.current
    if (!timeline) return
    const startClientX = e.clientX

    const origStart = req.planned_start!
    const origEnd = req.planned_end!

    e.preventDefault() // prevent text selection

    setDragging({
      id: req.id,
      origStart,
      origEnd,
      newStart: origStart,
      newEnd: origEnd
    })

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      const deltaX = e.clientX - startClientX
      const deltaDays = Math.round(deltaX / DAY_W)
      const newStart = addDays(origStart, deltaDays)
      const newEnd = addDays(origEnd, deltaDays)
      setDragging(prev => prev ? { ...prev, newStart, newEnd } : null)
    }

    const handleMouseUp = async () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (!dragging) return

      const { id, newStart, newEnd } = dragging
      try {
        await api.requirements.update(id, { planned_start: newStart, planned_end: newEnd })
        setReqs(prev => prev.map(r => r.id === id ? { ...r, planned_start: newStart, planned_end: newEnd } : r))
      } catch (err) {
        console.error('Failed to update requirement:', err)
      }
      setDragging(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

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

        <div ref={timelineRef} className="relative border-l border-r border-b rounded-lg overflow-x-auto bg-muted/30">
          <div
            className="border-b w-full"
            style={{
              backgroundImage: !isCollapsed
                ? `repeating-linear-gradient(to right, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${DAY_W}px)`
                : undefined,
              ...(!isCollapsed ? { width: `${totalDays * DAY_W}px` } : {})
            }}
          >
            <div className={cn("flex border-b text-xs relative", isCollapsed ? "w-full" : "")}>
              {totalDays <= 21 || axisExpanded ? (
                <>
                  {dateAxis.map(d => (
                    <div
                      key={d.toISOString()}
                      className="flex-shrink-0 px-1 py-1 text-muted-foreground text-[10px] text-center"
                      style={{ width: `${DAY_W}px` }}
                    >
                      {formatDate(d)}
                    </div>
                  ))}
                  {totalDays > 21 && (
                    <button
                      onClick={() => setAxisExpanded(false)}
                      className="absolute right-2 top-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer bg-background border rounded px-1"
                    >
                      收起
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Head 7 days */}
                  {dateAxis.slice(0, HEAD).map(d => (
                    <div
                      key={d.toISOString()}
                      className="flex-shrink-0 px-1 py-1 text-muted-foreground text-[10px] text-center border-r"
                      style={{ width: `${DAY_W}px` }}
                    >
                      {formatDate(d)}
                    </div>
                  ))}
                  {/* Collapsible middle section - flex-1 to fill remaining space */}
                  <div
                    className="flex-1 px-1 py-1 bg-muted/50 text-muted-foreground italic text-center text-[10px] cursor-pointer hover:bg-muted/70 border-r"
                    onClick={() => setAxisExpanded(true)}
                  >
                    …{totalDays - HEAD - TAIL} 天…
                  </div>
                  {/* Tail 7 days */}
                  {dateAxis.slice(-TAIL).map(d => (
                    <div
                      key={d.toISOString()}
                      className="flex-shrink-0 px-1 py-1 text-muted-foreground text-[10px] text-center border-r"
                      style={{ width: `${DAY_W}px` }}
                    >
                      {formatDate(d)}
                    </div>
                  ))}
                </>
              )}
            </div>
            {assigneeNames.map(assigneeName => (
              <div key={assigneeName}>
                <div className="bg-muted/50 px-2 py-1 text-sm font-bold border-b flex items-center gap-2">
                  {assigneeName}
                  <Badge variant="secondary" className="text-xs">{groupedByAssignee[assigneeName].length}</Badge>
                </div>
                {groupedByAssignee[assigneeName].map(r => {
                  const isDragging = dragging?.id === r.id
                  const displayStart = isDragging ? dragging.newStart : r.planned_start!
                  const displayEnd = isDragging ? dragging.newEnd : r.planned_end!
                  const startDay = position(displayStart)
                  const endDay = position(displayEnd)
                  // ponytail: clean 3-region rule - render segment for EVERY region touched

                  return (
                  <div key={r.id} className="relative h-8 border-b w-full">
                    {/* Render bar segments based on collapse state */}
                    {isCollapsed ? (
                      <>
                        {/* Head segment (startDay < HEAD) */}
                        {startDay < HEAD && (
                          <div
                            className={cn(
                              "absolute h-6 rounded-l px-2 text-xs flex items-center truncate",
                              STATUS_COLORS[r.status],
                              "cursor-default"
                            )}
                            style={{
                              left: `${startDay * DAY_W}px`,
                              width: `${(Math.min(endDay, HEAD) - startDay) * DAY_W}px`,
                              top: '4px'
                            }}
                            title={`${r.title} (${STATUS_LABEL[r.status]})`}
                          >
                            {r.title}
                          </div>
                        )}
                        {/* Middle/collapse segment (touches the middle) */}
                        {startDay < totalDays - TAIL && endDay > HEAD && (
                          <div
                            className={cn(
                              "absolute h-6 rounded px-2 text-xs flex items-center justify-center truncate",
                              STATUS_COLORS[r.status],
                              "cursor-default"
                            )}
                            style={{
                              left: `${HEAD * DAY_W}px`,
                              right: `${TAIL * DAY_W}px`,
                              top: '4px'
                            }}
                            title={`${r.title} (${STATUS_LABEL[r.status]}) - 跨${endDay - startDay}天`}
                          >
                            {startDay >= HEAD && endDay <= totalDays - TAIL ? r.title : `↔`}
                          </div>
                        )}
                        {/* Tail segment (endDay > totalDays - TAIL) */}
                        {endDay > totalDays - TAIL && (
                          <div
                            className={cn(
                              "absolute h-6 rounded-r px-2 text-xs flex items-center truncate",
                              STATUS_COLORS[r.status],
                              "cursor-default"
                            )}
                            style={{
                              right: `${(totalDays - endDay) * DAY_W}px`,
                              width: `${(endDay - Math.max(startDay, totalDays - TAIL)) * DAY_W}px`,
                              top: '4px'
                            }}
                            title={`${r.title} (${STATUS_LABEL[r.status]})`}
                          >
                            {startDay >= totalDays - TAIL ? r.title : ''}
                          </div>
                        )}
                      </>
                    ) : (
                      <div
                        className={cn(
                          "absolute h-6 rounded px-2 text-xs flex items-center truncate",
                          STATUS_COLORS[r.status],
                          isDragging ? "cursor-grabbing" : "cursor-grab"
                        )}
                        style={{
                          left: `${position(displayStart) * DAY_W}px`,
                          width: `${width(displayStart, displayEnd)}px`,
                          top: '4px'
                        }}
                        title={`${r.title} (${STATUS_LABEL[r.status]})`}
                        onMouseDown={(e) => handleMouseDown(e, r)}
                      >
                        {r.title}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

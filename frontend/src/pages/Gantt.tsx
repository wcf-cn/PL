import { useEffect, useState, useRef } from 'react'
import { api } from '../api'
import { STATUS_LABEL, type Sprint, type Requirement, type Status } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
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
const BASE_DAY_W = 44

// Gap-based collapse threshold
const GAP_THRESHOLD = 4
const COLLAPSE_MARKER_WIDTH = 96

export default function Gantt() {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [sid, setSid] = useState<number | ''>('')
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [dragging, setDragging] = useState<{id: number, origStart: string, origEnd: string, newStart: string, newEnd: string} | null>(null)
  const [axisExpanded, setAxisExpanded] = useState(false)
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set())
  const [containerWidth, setContainerWidth] = useState(0)
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

  // Measure container width for adaptive day width
  useEffect(() => {
    const timeline = timelineRef.current
    if (!timeline) return

    const updateWidth = () => {
      setContainerWidth(timeline.clientWidth)
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(timeline)

    return () => resizeObserver.disconnect()
  }, [])

  const validReqs = reqs.filter(r => r.planned_start && r.planned_end)
  if (!validReqs.length) return <Card className="p-6"><CardContent className="text-sm text-muted-foreground">该迭代无计划日期的需求</CardContent></Card>

  // Parse dates consistently at midnight local time
  const parseDate = (d: string) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
  const selectedSprint = sprints.find(s => s.id === sid)
  const dates = validReqs.flatMap(r => [parseDate(r.planned_start!), parseDate(r.planned_end!)])
  // 纳入整个 sprint 周期,日期补全到 sprint 末(不只任务最晚日期)
  if (selectedSprint) {
    dates.push(parseDate(selectedSprint.start_date), parseDate(selectedSprint.end_date))
  }
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))

  const position = (dateStr: string) => {
    const date = parseDate(dateStr)
    return Math.floor((date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Compute occupied days (union of all task intervals)
  const occupiedDays = new Set<number>()
  validReqs.forEach(req => {
    const startDay = position(req.planned_start!)
    const endDay = position(req.planned_end!)
    for (let day = startDay; day <= endDay; day++) {
      occupiedDays.add(day)
    }
  })

  // Build segments: expanded runs and collapsible gaps
  interface Segment {
    type: 'expanded' | 'gap'
    startDay: number
    endDay: number
    gapId?: string  // for gap segments
  }

  const buildSegments = (): Segment[] => {
    const segments: Segment[] = []
    let i = 0
    while (i <= totalDays) {
      if (occupiedDays.has(i)) {
        // occupied run → expanded
        const start = i
        while (i <= totalDays && occupiedDays.has(i)) i++
        segments.push({ type: 'expanded', startDay: start, endDay: i - 1 })
      } else {
        // empty run
        const start = i
        while (i <= totalDays && !occupiedDays.has(i)) i++
        const end = i - 1
        const len = end - start + 1
        if (len > GAP_THRESHOLD) {
          segments.push({ type: 'gap', startDay: start, endDay: end, gapId: `gap-${start}-${end}` })
        } else {
          // small gap stays expanded
          segments.push({ type: 'expanded', startDay: start, endDay: end })
        }
      }
    }
    // merge adjacent expanded segments
    const merged: Segment[] = []
    segments.forEach(seg => {
      const last = merged[merged.length - 1]
      if (last && last.type === 'expanded' && seg.type === 'expanded' && seg.startDay === last.endDay + 1) {
        last.endDay = seg.endDay
      } else {
        merged.push({ ...seg })
      }
    })
    return merged
  }

  const buildSegmentsWithExpansion = (): Segment[] => {
    return buildSegments().map(seg => {
      // a gap that's individually expanded OR globally expanded → render as expanded day-cells
      if (seg.type === 'gap' && (axisExpanded || (seg.gapId && expandedGaps.has(seg.gapId)))) {
        return { ...seg, type: 'expanded' as const }
      }
      return seg
    })
  }

  const segments = buildSegmentsWithExpansion()
  const hasGaps = buildSegments().some(s => s.type === 'gap')
  // 任务段(occupied)拉伸填满容器:空段窄标记占固定宽,剩余宽度均分给任务天;
  // 任务多到 BASE_DAY_W 都放不下时退回 BASE_DAY_W(横向滚动)
  const gapCount = segments.filter(s => s.type === 'gap').length
  const occupiedDayCount = occupiedDays.size
  const DAY_W = occupiedDayCount > 0 && containerWidth > 0
    ? Math.max(BASE_DAY_W, Math.floor((containerWidth - gapCount * COLLAPSE_MARKER_WIDTH) / occupiedDayCount))
    : BASE_DAY_W

  // Build dayToX mapping and total width
  let cumulativeX = 0
  const dayToXMap = new Map<number, number>()

  segments.forEach(seg => {
    if (seg.type === 'expanded') {
      for (let day = seg.startDay; day <= seg.endDay; day++) {
        dayToXMap.set(day, cumulativeX)
        cumulativeX += DAY_W
      }
    } else {
      // Collapsed gap: all days in gap map to same X (marker center)
      for (let day = seg.startDay; day <= seg.endDay; day++) {
        dayToXMap.set(day, cumulativeX + COLLAPSE_MARKER_WIDTH / 2)
      }
      cumulativeX += COLLAPSE_MARKER_WIDTH
    }
  })

  const dayToX = (day: number): number => {
    return dayToXMap.get(day) ?? 0
  }

  const timelineWidth = cumulativeX

  const formatDate = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`

  // Date helper: add N days to YYYY-MM-DD string, returning new YYYY-MM-DD at local midnight
  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0) // normalize to midnight local to avoid TZ off-by-one
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

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
          <div className="flex items-center gap-2">
            {hasGaps && (
              axisExpanded
                ? <Button variant="outline" size="sm" onClick={() => { setAxisExpanded(false); setExpandedGaps(new Set()) }}>收起空段</Button>
                : <Button variant="outline" size="sm" onClick={() => setAxisExpanded(true)}>全部展开</Button>
            )}
            <Select value={sid?.toString() || ''} onValueChange={(v) => setSid(v ? Number(v) : '')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="选择迭代" />
              </SelectTrigger>
              <SelectContent>
                {sprints.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
            className="border-b"
            style={{
              width: `${timelineWidth}px`,
              minWidth: '100%',
              backgroundImage: `repeating-linear-gradient(to right, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${DAY_W}px)`
            }}
          >
            <div className="flex border-b text-xs relative">
              {segments.map(seg => {
                if (seg.type === 'expanded') {
                  return Array.from({ length: seg.endDay - seg.startDay + 1 }, (_, i) => {
                    const day = seg.startDay + i
                    const d = new Date(minDate)
                    d.setDate(d.getDate() + day)
                    return (
                      <div
                        key={day}
                        className="flex-shrink-0 px-1 py-1 text-muted-foreground text-[10px] text-center border-r"
                        style={{ width: `${DAY_W}px` }}
                      >
                        {formatDate(d)}
                      </div>
                    )
                  })
                } else {
                  return (
                    <div
                      key={seg.gapId}
                      className="flex-shrink-0 px-1 py-1 bg-muted/50 text-muted-foreground italic text-center text-[10px] cursor-pointer hover:bg-muted/70 border-r"
                      style={{ width: `${COLLAPSE_MARKER_WIDTH}px` }}
                      onClick={() => {
                        if (seg.gapId) {
                          setExpandedGaps(prev => new Set([...prev, seg.gapId!]))
                        }
                      }}
                      title={`展开 ${seg.endDay - seg.startDay + 1} 天`}
                    >
                      …{seg.endDay - seg.startDay + 1} 天…
                    </div>
                  )
                }
              })}
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

                  return (
                  <div key={r.id} className="relative h-8 border-b">
                    <div
                      className={cn(
                        "absolute h-6 rounded px-2 text-xs flex items-center truncate",
                        STATUS_COLORS[r.status],
                        isDragging ? "cursor-grabbing" : "cursor-grab"
                      )}
                      style={{
                        left: `${dayToX(startDay)}px`,
                        width: `${dayToX(endDay) - dayToX(startDay) + DAY_W}px`,
                        top: '4px'
                      }}
                      title={`${r.title} (${STATUS_LABEL[r.status]})`}
                      onMouseDown={(e) => handleMouseDown(e, r)}
                    >
                      {r.title}
                    </div>
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

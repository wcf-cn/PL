import { useEffect, useState } from 'react'
import { api } from '../api'
import { STATUS_LABEL, STATUS_ORDER, calcProgress, type Requirement, type Status, type Member, type Sprint, type Priority } from '../types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { cn } from '../lib/utils'

const PRIO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  P0: 'destructive',
  P1: 'default',
  P2: 'secondary'
}

export default function Board() {
  const [items, setItems] = useState<Requirement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [milestones, setMilestones] = useState<any[]>([])
  const [mtitle, setMTitle] = useState('')
  const [mdate, setMDate] = useState('')
  const [mnote, setMNote] = useState('')
  const [error, setError] = useState('')
  const load = () => api.requirements.list().then(setItems)
  useEffect(() => {
    load()
    api.members.list().then(setMembers)
    api.sprints.list().then(setSprints)
  }, [])
  const onDrop = async (status: Status, id: number) => {
    const r = items.find(x => x.id === id); if (!r || r.status === status) return
    const newProgress = calcProgress(r.est_effort, r.actual_effort)
    setItems(prev => prev.map(x => x.id === id ? { ...x, status, progress: newProgress } : x))
    await api.requirements.update(id, { status, progress: newProgress })
  }

  const loadMilestones = async (reqId: number) => {
    try {
      const data = await api.milestones.list({ requirement: String(reqId) })
      setMilestones(data)
    } catch {
      setMilestones([])
    }
  }

  const startEdit = (item: Requirement) => {
    setEditingId(item.id)
    setForm({
      title: item.title,
      status: item.status,
      priority: item.priority,
      assignee: item.assignee,
      module: item.module,
      est_effort: String(item.est_effort),
      actual_effort: String(item.actual_effort || 0),
      planned_start: item.planned_start || '',
      planned_end: item.planned_end || '',
      assigned_sprint: item.assigned_sprint
    })
    setShowForm(true)
    loadMilestones(item.id)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setMilestones([])
    setError('')
    setForm({ title: '', status: 'backlog', priority: 'P1', assignee: null, module: '', est_effort: '', actual_effort: '', planned_start: '', planned_end: '', assigned_sprint: null })
    setMTitle(''); setMDate(''); setMNote('')
  }

  const [form, setForm] = useState({
    title: '',
    status: 'backlog' as Status,
    priority: 'P1' as Priority,
    assignee: null as number | null,
    module: '',
    est_effort: '',
    actual_effort: '',
    planned_start: '',
    planned_end: '',
    assigned_sprint: null as number | null
  })

  const createReq = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      const est = Number(form.est_effort) || 0
      const actual = Number(form.actual_effort) || 0
      const payload = {
        title: form.title,
        status: form.status,
        priority: form.priority,
        assignee: form.assignee,
        module: form.module || '',
        est_effort: est,
        actual_effort: actual,
        progress: calcProgress(est, actual),
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
        assigned_sprint: form.assigned_sprint
      }
      if (editingId) {
        const updated = await api.requirements.update(editingId, payload)
        setItems(prev => prev.map(x => x.id === editingId ? updated : x))
      } else {
        const created = await api.requirements.create(payload)
        setItems(prev => [created, ...prev])
      }
      closeForm()
    } catch (err: any) {
      const d = err.response?.data
      let msg = editingId ? '更新失败' : '创建失败'
      if (typeof d === 'string') msg = d
      else if (d?.detail) msg = d.detail
      else if (d && typeof d === 'object') msg = Object.entries(d).map(([f, e]) => `${f}: ${Array.isArray(e) ? e.join(',') : e}`).join('; ')
      setError(msg)
    }
  }

  const addMilestone = async () => {
    if (!editingId) return
    if (!mtitle.trim() || !mdate) return
    try {
      await api.milestones.create({ requirement: editingId, title: mtitle, date: mdate, note: mnote })
      setMTitle(''); setMDate(''); setMNote('')
      loadMilestones(editingId)
    } catch {
      setError('添加里程碑失败')
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setShowForm(!showForm)}>+ 新建需求</Button>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? '编辑需求' : '新建需求'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createReq} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">标题 *</Label>
                  <Input
                    id="title"
                    required
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                    placeholder="请输入标题"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">状态</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({...form, status: v as Status})}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">优先级</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v as Priority})}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P0">P0</SelectItem>
                      <SelectItem value="P1">P1</SelectItem>
                      <SelectItem value="P2">P2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignee">负责人</Label>
                  <Select value={form.assignee?.toString() || ''} onValueChange={(v) => setForm({...form, assignee: v ? Number(v) : null})}>
                    <SelectTrigger id="assignee">
                      <SelectValue placeholder="未分配" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">未分配</SelectItem>
                      {members.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="module">模块</Label>
                  <Input
                    id="module"
                    value={form.module}
                    onChange={e => setForm({...form, module: e.target.value})}
                    placeholder="模块名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="est_effort">预计工时h</Label>
                  <Input
                    id="est_effort"
                    type="number"
                    value={form.est_effort}
                    onChange={e => setForm({...form, est_effort: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actual_effort">已投入时间h</Label>
                  <Input
                    id="actual_effort"
                    type="number"
                    value={form.actual_effort}
                    onChange={e => setForm({...form, actual_effort: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planned_start">计划开始</Label>
                  <Input
                    id="planned_start"
                    type="date"
                    value={form.planned_start}
                    onChange={e => setForm({...form, planned_start: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planned_end">计划结束</Label>
                  <Input
                    id="planned_end"
                    type="date"
                    value={form.planned_end}
                    onChange={e => setForm({...form, planned_end: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sprint">所属迭代</Label>
                  <Select value={form.assigned_sprint?.toString() || ''} onValueChange={(v) => setForm({...form, assigned_sprint: v ? Number(v) : null})}>
                    <SelectTrigger id="sprint">
                      <SelectValue placeholder="未分配" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">未分配</SelectItem>
                      {sprints.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editingId && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="font-medium">里程碑 ({milestones.length})</div>
                    <div className="space-y-2">
                      {milestones.map(m => (
                        <Card key={m.id}>
                          <CardContent className="p-3">
                            <div className="font-medium">{m.title}</div>
                            <div className="text-sm text-muted-foreground">{m.date} {m.note && `- ${m.note}`}</div>
                          </CardContent>
                        </Card>
                      ))}
                      {milestones.length === 0 && <div className="text-sm text-muted-foreground">暂无里程碑</div>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={mtitle}
                        onChange={e=>setMTitle(e.target.value)}
                        placeholder="里程碑标题"
                      />
                      <Input
                        type="date"
                        value={mdate}
                        onChange={e=>setMDate(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Input
                          value={mnote}
                          onChange={e=>setMNote(e.target.value)}
                          placeholder="备注"
                          className="flex-1"
                        />
                        <Button type="button" onClick={addMilestone} size="sm">添加</Button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {error && <div className="text-destructive text-sm">{error}</div>}
              <div className="flex gap-2">
                <Button type="submit">提交</Button>
                <Button type="button" variant="outline" onClick={closeForm}>取消</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.map(st => (
          <Column key={st} status={st} items={items.filter(r => r.status === st)} onDrop={onDrop} onEdit={startEdit} />
        ))}
      </div>
    </div>
  )
}

function Column({ status, items, onDrop, onEdit }:{ status:Status; items:Requirement[]; onDrop:(s:Status,id:number)=>void; onEdit:(r:Requirement)=>void }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e=>{e.preventDefault();setOver(true)}}
      onDragLeave={()=>setOver(false)}
      onDrop={(e:any)=>{setOver(false); const id=Number((e as any).dataTransfer.getData('id')); if (id) onDrop(status, id)}}
      className={cn(
        "w-64 shrink-0 p-4 rounded-lg bg-muted/50 min-h-[400px] border",
        over && 'ring-2 ring-primary'
      )}
    >
      <div className="flex justify-between items-center mb-3 pb-2 border-b">
        <h3 className="font-semibold">{STATUS_LABEL[status]}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div
        onDrop={e=>{e.stopPropagation(); setOver(false); onDrop(status, Number((e as any).dataTransfer.getData('id')))}}
        className="min-h-[300px] space-y-2"
      >
        {items.map(r => (
          <RequirementCard key={r.id} requirement={r} onEdit={onEdit} />
        ))}
      </div>
    </div>
  )
}

function RequirementCard({ requirement, onEdit }: { requirement: Requirement; onEdit: (r: Requirement) => void }) {
  return (
    <Card
      draggable
      onDragStart={e=>(e as any).dataTransfer.setData('id', String(requirement.id))}
      onDoubleClick={()=>onEdit(requirement)}
      className="cursor-move hover:shadow-md transition-shadow"
    >
      <CardContent className="p-3">
        <div className="font-medium mb-2">{requirement.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={PRIO_VARIANT[requirement.priority]} className="text-xs">
            {requirement.priority}
          </Badge>
          <span>{requirement.assignee_name||'未分配'}</span>
          <span>预计 {requirement.est_effort}h</span>
          {requirement.actual_effort > 0 && <span>/ 已投 {requirement.actual_effort}h</span>}
          <span>{calcProgress(requirement.est_effort, requirement.actual_effort)}%</span>
          {(requirement.planned_start || requirement.planned_end) && (
            <span>{requirement.planned_start || '?'}~{requirement.planned_end || '?'}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

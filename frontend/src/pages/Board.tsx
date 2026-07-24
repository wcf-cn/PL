import { useEffect, useState } from 'react'
import { api } from '../api'
import { STATUS_LABEL, STATUS_ORDER, type Requirement, type Status, type Member, type Priority, type Version } from '../types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { cn } from '../lib/utils'

const PRIO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  P0: 'destructive',
  P1: 'default',
  P2: 'secondary'
}

export default function Board() {
  const [items, setItems] = useState<Requirement[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [versionFilter, setVersionFilter] = useState<number | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<number | null>(null)
  const [moduleFilter, setModuleFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [milestones, setMilestones] = useState<any[]>([])
  const [mtitle, setMTitle] = useState('')
  const [mdate, setMDate] = useState('')
  const [mnote, setMNote] = useState('')
  const [error, setError] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const load = () => api.requirements.list().then(setItems)
  useEffect(() => {
    load()
    api.members.list().then(setMembers)
    api.versions.list().then(setVersions)
  }, [])
  const onDrop = async (status: Status, id: number) => {
    const r = items.find(x => x.id === id); if (!r || r.status === status) return
    setItems(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    await api.requirements.update(id, { status })
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
      progress: item.progress,
      planned_start: item.planned_start || '',
      planned_end: item.planned_end || '',
    })
    setShowForm(true)
    loadMilestones(item.id)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setMilestones([])
    setError('')
    setForm({ title: '', status: 'backlog', priority: 'P1', assignee: null, module: '', est_effort: '', actual_effort: '', progress: 0, planned_start: '', planned_end: '' })
    setMTitle(''); setMDate(''); setMNote('')
  }

  const deleteReq = async () => {
    if (!editingId) return
    if (!window.confirm('确认删除该需求?关联的里程碑也会一并删除。')) return
    try {
      await api.requirements.remove(editingId)
      setItems(prev => prev.filter(r => r.id !== editingId))
      closeForm()
    } catch {
      setError('删除失败')
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()) }
  const batchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`确认删除选中的 ${selectedIds.size} 个需求?关联里程碑也会删除。`)) return
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map(id => api.requirements.remove(id)))
      setItems(prev => prev.filter(r => !selectedIds.has(r.id)))
      exitSelect()
    } catch {
      setError('批量删除失败')
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ title: '', status: 'backlog', priority: 'P1', assignee: null, module: '', est_effort: '', actual_effort: '', progress: 0, planned_start: '', planned_end: '' })
    setMilestones([])
    setError('')
    setShowForm(true)
  }

  const [form, setForm] = useState({
    title: '',
    status: 'backlog' as Status,
    priority: 'P1' as Priority,
    assignee: null as number | null,
    module: '',
    est_effort: '',
    actual_effort: '',
    progress: 0 as number,
    planned_start: '',
    planned_end: '',
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
        progress: form.progress,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
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
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={openCreate}>+ 新建需求</Button>
        <Button variant="outline" onClick={() => setShowDone(!showDone)}>
          {showDone ? '隐藏已上线' : '显示已上线'}
        </Button>
        <Button variant={selectMode ? 'default' : 'outline'} onClick={() => selectMode ? exitSelect() : setSelectMode(true)}>
          {selectMode ? '取消选择' : '选择'}
        </Button>
        {selectMode && selectedIds.size > 0 && (
          <Button variant="destructive" onClick={batchDelete}>批量删除({selectedIds.size})</Button>
        )}
        <Select value={versionFilter?.toString() ?? ''} onValueChange={(v) => setVersionFilter(v ? Number(v) : null)}>
          <SelectTrigger id="version-filter" className="w-32"><SelectValue placeholder="全部版本" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部版本</SelectItem>
            {versions.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter?.toString() ?? ''} onValueChange={(v) => setAssigneeFilter(v ? Number(v) : null)}>
          <SelectTrigger className="w-28"><SelectValue placeholder="负责人" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部负责人</SelectItem>
            {members.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={moduleFilter || '__all__'} onValueChange={(v) => setModuleFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-28"><SelectValue placeholder="模块" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部模块</SelectItem>
            {Array.from(new Set(items.map(r => r.module).filter(Boolean))).map(mo => <SelectItem key={mo} value={mo}>{mo}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter || '__all__'} onValueChange={(v) => setPriorityFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-24"><SelectValue placeholder="优先级" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部优先级</SelectItem>
            {['P0','P1','P2'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑需求' : '新建需求'}</DialogTitle>
          </DialogHeader>
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
                  <Label htmlFor="progress">进度</Label>
                  <Select value={String(form.progress)} onValueChange={(v) => setForm({...form, progress: Number(v)})}>
                    <SelectTrigger id="progress">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0,25,50,75,100].map(p => <SelectItem key={p} value={String(p)}>{p}%</SelectItem>)}
                    </SelectContent>
                  </Select>
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
              <DialogFooter className="sm:justify-between gap-2">
                {editingId
                  ? <Button type="button" variant="destructive" onClick={deleteReq}>删除</Button>
                  : <div />}
                <div className="flex gap-2">
                  <Button type="submit">提交</Button>
                  <Button type="button" variant="outline" onClick={closeForm}>取消</Button>
                </div>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.filter(st => showDone || st !== 'done').map(st => (
          <Column key={st} status={st} items={items.filter(r => r.status === st && !r.parent && (versionFilter === null || r.version === versionFilter) && (assigneeFilter === null || r.assignee === assigneeFilter) && (moduleFilter === '' || r.module === moduleFilter) && (priorityFilter === '' || r.priority === priorityFilter))} allItems={items} onDrop={onDrop} onEdit={startEdit} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
        ))}
      </div>
    </div>
  )
}

function Column({ status, items, allItems, onDrop, onEdit, selectMode, selectedIds, onToggleSelect }:{ status:Status; items:Requirement[]; allItems:Requirement[]; onDrop:(s:Status,id:number)=>void; onEdit:(r:Requirement)=>void; selectMode:boolean; selectedIds:Set<number>; onToggleSelect:(id:number)=>void }) {
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
          <RequirementCard key={r.id} requirement={r} allItems={allItems} onEdit={onEdit} selectMode={selectMode} selected={selectedIds.has(r.id)} onToggle={onToggleSelect} />
        ))}
      </div>
    </div>
  )
}

function riskBadge(r: Requirement) {
  const today = new Date(); today.setHours(0,0,0,0)
  if (!r.planned_end || ['done','paused'].includes(r.status)) return null
  const end = new Date(r.planned_end)
  const days = Math.round((end.getTime() - today.getTime()) / 86400000)
  if (days < 0) return <Badge variant="destructive" className="text-xs">超期 {-days}天</Badge>
  if (days <= 2) return <Badge variant="secondary" className="text-xs">将至 {days}天</Badge>
  return null
}

function stuckBadge(r: Requirement) {
  if (r.status === 'done') return null
  const ts = r.last_status_change_at || r.created_at
  if (!ts) return null
  const days = Math.round((Date.now() - new Date(ts).getTime()) / 86400000)
  if (days >= 7) return <Badge variant="secondary" className="text-xs">卡 {days}天</Badge>
  return null
}

function RequirementCard({ requirement, allItems, onEdit, selectMode, selected, onToggle }: { requirement: Requirement; allItems: Requirement[]; onEdit: (r: Requirement) => void; selectMode: boolean; selected: boolean; onToggle: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  const children = allItems.filter(r => r.parent === requirement.id)
  const hasChildren = children.length > 0
  return (
    <Card
      draggable={!selectMode}
      onDragStart={e=>(e as any).dataTransfer.setData('id', String(requirement.id))}
      onClick={selectMode ? () => onToggle(requirement.id) : undefined}
      onDoubleClick={selectMode ? undefined : () => onEdit(requirement)}
      className={cn(
        selectMode ? 'cursor-pointer' : 'cursor-move',
        'hover:shadow-md transition-shadow relative',
        selectMode && selected && 'ring-2 ring-primary'
      )}
    >
      {selectMode && selected && (
        <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span>
      )}
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">{requirement.title}</span>
          {hasChildren && !selectMode && (
            <button onClick={(e)=>{e.stopPropagation(); setExpanded(!expanded)}} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Badge variant="secondary">子{children.length}</Badge>
              {expanded ? '▼' : '▶'}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={PRIO_VARIANT[requirement.priority]} className="text-xs">
            {requirement.priority}
          </Badge>
          <span>{requirement.assignee_name||'未分配'}</span>
          <span>预计 {requirement.est_effort}h</span>
          {requirement.actual_effort > 0 && <span>/ 已投 {requirement.actual_effort}h</span>}
          <span>{requirement.progress}%</span>
          {(requirement.planned_start || requirement.planned_end) && (
            <span>{requirement.planned_start || '?'}~{requirement.planned_end || '?'}</span>
          )}
          {riskBadge(requirement)}
          {stuckBadge(requirement)}
          {requirement.blocked_by.length > 0 && <Badge variant="outline" className="text-xs">🔒 被阻塞({requirement.blocked_by.length})</Badge>}
        </div>
        {expanded && hasChildren && (
          <div className="mt-3 pl-3 border-l-2 border-muted space-y-2">
            {children.map(c => (
              <div key={c.id} onDoubleClick={(e)=>{e.stopPropagation(); onEdit(c)}} className="text-xs bg-muted/30 rounded p-2 cursor-pointer hover:bg-muted/50">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">↳</span>
                  {c.note && c.note.match(/\[(.+?)\]/) ? <Badge variant="outline" className="text-xs">{c.note.match(/\[(.+?)\]/)![1]}</Badge> : null}
                  <span className="font-medium">{c.title}</span>
                </div>
                <div className="text-muted-foreground mt-0.5">{c.assignee_name||'未分配'} · {c.est_effort}h · {STATUS_LABEL[c.status]}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

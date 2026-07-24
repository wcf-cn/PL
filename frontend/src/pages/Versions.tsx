import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Version, Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'

const PHASE_DATES: Array<[keyof Version, string]> = [
  ['integration_date', '联调'],
  ['freeze_date', '封板'],
  ['test_date', '转测'],
  ['release_date', '发布'],
]

const DATE_FIELDS: Array<[keyof Pick<Version,'integration_date'|'freeze_date'|'test_date'|'release_date'>, string]> = [
  ['integration_date', '联调日'],
  ['freeze_date', '封板日'],
  ['test_date', '转测日'],
  ['release_date', '发布日'],
]

function phaseVariant(p: string) {
  if (p === '已发布') return 'secondary' as const
  if (p === '规划中') return 'outline' as const
  return 'default' as const
}

const emptyForm = { name: '', integration_date: '', freeze_date: '', test_date: '', release_date: '', note: '' }
type FormState = typeof emptyForm

export default function Versions() {
  const [versions, setVersions] = useState<Version[]>([])
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState('')

  const load = () => api.versions.list().then(setVersions)
  useEffect(() => {
    load()
    api.requirements.list().then(setReqs)
  }, [])

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); setError('') }
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true) }
  const startEdit = (v: Version) => {
    setEditingId(v.id)
    setForm({
      name: v.name,
      integration_date: v.integration_date || '',
      freeze_date: v.freeze_date || '',
      test_date: v.test_date || '',
      release_date: v.release_date || '',
      note: v.note || '',
    })
    setShowForm(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      integration_date: form.integration_date || null,
      freeze_date: form.freeze_date || null,
      test_date: form.test_date || null,
      release_date: form.release_date || null,
      note: form.note,
    }
    try {
      if (editingId) {
        const updated = await api.versions.update(editingId, payload)
        setVersions(prev => prev.map(v => v.id === editingId ? updated : v))
      } else {
        const created = await api.versions.create(payload)
        setVersions(prev => [created, ...prev])
      }
      closeForm()
    } catch (err: any) {
      const d = err.response?.data
      setError(typeof d === 'string' ? d : d?.detail
        || (d && typeof d === 'object' && Object.entries(d).map(([f, e]) => `${f}: ${Array.isArray(e) ? (e as string[]).join(',') : e}`).join('; '))
        || '保存失败')
    }
  }

  const del = async (id: number) => {
    if (!window.confirm('确认删除该版本?关联的需求会变成"无版本"。')) return
    try {
      await api.versions.remove(id)
      setVersions(prev => prev.filter(v => v.id !== id))
    } catch { setError('删除失败') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={openCreate}>+ 新建版本</Button>
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm() }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingId ? '编辑版本' : '新建版本'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vname">版本名 *</Label>
              <Input id="vname" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="如 v2.1 / 2026-08迭代" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {DATE_FIELDS.map(([k, label]) => (
                <div className="space-y-2" key={k}>
                  <Label htmlFor={k}>{label}</Label>
                  <Input id={k} type="date" value={form[k]}
                    onChange={e => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vnote">备注</Label>
              <Textarea id="vnote" value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
            {error && <div className="text-destructive text-sm">{error}</div>}
            <DialogFooter>
              <Button type="submit">提交</Button>
              <Button type="button" variant="outline" onClick={closeForm}>取消</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>版本管理</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {versions.length === 0 && <div className="text-sm text-muted-foreground">暂无版本,点「+ 新建版本」创建。</div>}
          {versions.map(v => {
            const leaves = reqs.filter(r => r.version === v.id && !reqs.some(c => c.parent === r.id))
            const total = leaves.length
            const done = leaves.filter(r => r.status === 'done').length
            const pct = total > 0 ? Math.round(done / total * 100) : 0
            const remaining = leaves.filter(r => !['done', 'paused'].includes(r.status))
              .reduce((s, r) => s + Math.max(0, r.est_effort - r.actual_effort), 0)
            return (
              <Card key={v.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{v.name}</span>
                      <Badge variant={phaseVariant(v.current_phase)}>{v.current_phase}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(v)}>编辑</Button>
                      <Button size="sm" variant="destructive" onClick={() => del(v.id)}>删除</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {PHASE_DATES.map(([k, label]) => (
                      <span key={k}>{label}: <b className="text-foreground">{(v[k] as string) || '—'}</b></span>
                    ))}
                  </div>
                  <div className="text-xs">
                    进度 <b>{done}/{total}</b> · <b>{pct}%</b> · 剩余 <b>{remaining}h</b>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

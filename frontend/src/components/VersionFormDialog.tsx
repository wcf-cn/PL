import { useState, useEffect } from 'react'
import { api } from '../api'
import type { Version } from '../types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'

const PHASE_OPTIONS = ['', '规划中', '开发中', '联调中', '封板', '转测中', '已发布']
const DATE_FIELDS: Array<[ 'dev_start_date' | 'integration_date' | 'freeze_date' | 'test_date' | 'release_date', string]> = [
  ['dev_start_date', '投入开始日'], ['integration_date', '联调日'], ['freeze_date', '封板日'], ['test_date', '转测日'], ['release_date', '发布日'],
]

const EMPTY = { name: '', phase: '', dev_start_date: '', integration_date: '', freeze_date: '', test_date: '', release_date: '', note: '' }

/** 版本新建/编辑共享弹窗。version=null 为新建。 */
export function VersionFormDialog({ open, version, onClose, onSaved }: {
  open: boolean
  version: Version | null
  onClose: () => void
  onSaved: (v: Version) => void
}) {
  const [form, setForm] = useState({ ...EMPTY })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(version ? {
      name: version.name, phase: version.phase || '', dev_start_date: version.dev_start_date || '',
      integration_date: version.integration_date || '', freeze_date: version.freeze_date || '',
      test_date: version.test_date || '', release_date: version.release_date || '', note: version.note || '',
    } : { ...EMPTY })
  }, [open, version])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(), phase: form.phase, dev_start_date: form.dev_start_date || null,
      integration_date: form.integration_date || null, freeze_date: form.freeze_date || null,
      test_date: form.test_date || null, release_date: form.release_date || null, note: form.note,
    }
    try {
      const saved = version ? await api.versions.update(version.id, payload) : await api.versions.create(payload)
      onSaved(saved)
      onClose()
    } catch (err: any) {
      const d = err.response?.data
      setError(typeof d === 'string' ? d : d?.detail
        || (d && typeof d === 'object' && Object.entries(d).map(([f, e]) => `${f}: ${Array.isArray(e) ? (e as string[]).join(',') : e}`).join('; '))
        || '保存失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{version ? '编辑版本' : '新建版本'}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vname">版本名 *</Label>
            <Input id="vname" required value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="如 v2.1 / 2026-08迭代" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vphase">当前阶段(留空=按日期自动派生)</Label>
            <Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v === '__auto__' ? '' : v })}>
              <SelectTrigger id="vphase"><SelectValue placeholder="自动(按日期)" /></SelectTrigger>
              <SelectContent>
                {PHASE_OPTIONS.map(p => <SelectItem key={p || '__auto__'} value={p || '__auto__'}>{p || '自动(按日期)'}</SelectItem>)}
              </SelectContent>
            </Select>
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
            <Button type="submit">{version ? '保存' : '创建'}</Button>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

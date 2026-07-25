import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Version, Requirement } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { VersionFormDialog } from '../components/VersionFormDialog'

const PHASE_DATES: Array<[keyof Version, string]> = [
  ['integration_date', '联调'], ['freeze_date', '封板'], ['test_date', '转测'], ['release_date', '发布'],
]
const PHASE_OPTIONS = ['', '规划中', '联调中', '封板', '转测中', '已发布']

export default function Versions() {
  const [versions, setVersions] = useState<Version[]>([])
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingVersion, setEditingVersion] = useState<Version | null>(null)
  const [error, setError] = useState('')

  const load = () => api.versions.list().then(setVersions)
  useEffect(() => { load(); api.requirements.list().then(setReqs) }, [])

  const openCreate = () => { setEditingVersion(null); setShowForm(true) }
  const startEdit = (v: Version) => { setEditingVersion(v); setShowForm(true) }
  const onSaved = (v: Version) => {
    setVersions(prev => prev.some(x => x.id === v.id) ? prev.map(x => x.id === v.id ? v : x) : [v, ...prev])
  }
  const del = async (id: number) => {
    if (!window.confirm('确认删除该版本?关联的需求会变成"无版本"。')) return
    try { await api.versions.remove(id); setVersions(prev => prev.filter(v => v.id !== id)) }
    catch { setError('删除失败') }
  }
  // 内联快速改阶段(免开编辑弹窗)
  const changePhase = async (v: Version, phase: string) => {
    try {
      const updated = await api.versions.update(v.id, { phase })
      setVersions(prev => prev.map(x => x.id === v.id ? updated : x))
    } catch { setError('改阶段失败') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={openCreate}>+ 新建版本</Button>
      </div>

      <VersionFormDialog open={showForm} version={editingVersion} onClose={() => setShowForm(false)} onSaved={onSaved} />

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
                      <Select value={v.phase || '__auto__'} onValueChange={(p) => changePhase(v, p === '__auto__' ? '' : p)}>
                        <SelectTrigger className="h-6 w-24 text-xs"><SelectValue>{v.phase || '自动'}</SelectValue></SelectTrigger>
                        <SelectContent>
                          {PHASE_OPTIONS.map(p => <SelectItem key={p || '__auto__'} value={p || '__auto__'}>{p || '自动(按日期)'}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
                    <span className="ml-2 text-muted-foreground">(当前阶段:{v.current_phase})</span>
                  </div>
                  {v.note && <div className="text-xs text-muted-foreground">{v.note}</div>}
                </CardContent>
              </Card>
            )
          })}
          {error && <div className="text-destructive text-sm">{error}</div>}
        </CardContent>
      </Card>
    </div>
  )
}

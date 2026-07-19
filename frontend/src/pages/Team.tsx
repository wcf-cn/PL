import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Member } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'

export default function Team() {
  const [members, setMembers] = useState<Member[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', week_capacity: '40', modules: '', active: true })
  const [error, setError] = useState('')

  const load = () => api.members.list().then(setMembers)
  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', week_capacity: '40', modules: '', active: true })
    setShowForm(true); setError('')
  }

  const openEdit = (m: Member) => {
    setEditingId(m.id)
    setForm({ name: m.name, week_capacity: String(m.week_capacity), modules: m.modules, active: m.active })
    setShowForm(true); setError('')
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setError('') }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = { name: form.name, week_capacity: Number(form.week_capacity) || 40, modules: form.modules, active: form.active }
    try {
      if (editingId) {
        await api.members.update(editingId, payload)
      } else {
        await api.members.create(payload as any)
      }
      closeForm(); load()
    } catch (err: any) {
      const d = err.response?.data
      setError(typeof d === 'string' ? d : d?.detail || '操作失败')
    }
  }

  const remove = async (id: number, name: string) => {
    if (!confirm(`确认删除成员「${name}」?`)) return
    try { await api.members.remove(id); load() }
    catch { setError('删除失败(该成员可能关联了需求)') }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>团队成员</CardTitle>
            <Button onClick={openCreate}>+ 添加成员</Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 电脑:Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>周容量(h)</TableHead>
                  <TableHead>模块</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.week_capacity}</TableCell>
                    <TableCell>{m.modules || '-'}</TableCell>
                    <TableCell>{m.active ? <Badge>在职</Badge> : <Badge variant="outline">离职</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(m)}>编辑</Button>
                        <Button variant="destructive" size="sm" onClick={() => remove(m.id, m.name)}>删除</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {members.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">暂无成员,点「+ 添加成员」</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* 手机:卡片 */}
          <div className="md:hidden space-y-2">
            {members.map(m => (
              <div key={m.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{m.name}</span>
                    <span className="ml-2">{m.active ? <Badge>在职</Badge> : <Badge variant="outline">离职</Badge>}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(m)}>编辑</Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(m.id, m.name)}>删</Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">周容量{m.week_capacity}h · {m.modules || '无模块'}</div>
              </div>
            ))}
            {members.length === 0 && <div className="text-center text-muted-foreground text-sm">暂无成员</div>}
          </div>
          {error && <div className="text-destructive text-sm mt-2">{error}</div>}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) closeForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? '编辑成员' : '添加成员'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="m-name">姓名 *</Label>
              <Input id="m-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="姓名" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-cap">周容量(h)</Label>
              <Input id="m-cap" type="number" value={form.week_capacity} onChange={e => setForm({ ...form, week_capacity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-mod">模块(逗号分隔)</Label>
              <Input id="m-mod" value={form.modules} onChange={e => setForm({ ...form, modules: e.target.value })} placeholder="后端,前端" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="m-active" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
              <Label htmlFor="m-active">在职</Label>
            </div>
            {error && <div className="text-destructive text-sm">{error}</div>}
            <DialogFooter>
              <Button type="submit">{editingId ? '保存' : '添加'}</Button>
              <Button type="button" variant="outline" onClick={closeForm}>取消</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

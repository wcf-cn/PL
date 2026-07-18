import { useState } from 'react'
import { api } from '../api'
import type { ChatMessage, Draft } from '../types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card } from './ui/card'

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [drafts, setDrafts] = useState<(Draft & { _idx?: number })[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(''); setLoading(true); setError('')
    try {
      const { reply, drafts: d } = await api.aiChat(input, history)
      setMessages([...newMessages, { role: 'assistant', content: reply }])
      setHistory([...history, userMsg, { role: 'assistant', content: reply }])
      if (d.length) setDrafts(prev => [...prev, ...d])
    } catch (e: any) {
      setError(e.response?.data?.detail || 'AI 调用失败')
    } finally {
      setLoading(false)
    }
  }

  const importDraft = async (idx: number) => {
    const d = drafts[idx]
    try {
      await api.requirements.create({
        title: d.title,
        status: (d.status as any) || 'backlog',
        priority: (d.priority as any) || 'P1',
        module: d.module || '',
        est_effort: d.est_effort || 0,
        assigned_sprint: d.assigned_sprint ?? null,
        assignee: d.assignee ?? null,
      })
      setDrafts(prev => prev.filter((_, i) => i !== idx))
    } catch {
      setError('导入失败')
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-50 rounded-full bg-primary text-primary-foreground w-14 h-14 shadow-lg text-sm font-bold hover:scale-105 transition-transform">AI</button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[80vh] flex flex-col shadow-xl">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-3 border-b bg-muted">
          <span className="font-semibold">AI 助手</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>✕</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-60">
          {messages.length === 0 && <div className="text-sm text-muted-foreground">描述你的需求,我帮你拆成卡片...如"下个迭代做登录注册和个人中心"</div>}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <span className={`inline-block px-3 py-1 rounded-lg text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{m.content}</span>
            </div>
          ))}
          {loading && <div className="text-sm text-muted-foreground">思考中...</div>}
          {drafts.map((d, idx) => (
            <Card key={idx} className="p-2 bg-amber-50 border-amber-200">
              <div className="text-sm font-medium">{d.title}</div>
              <div className="text-xs text-muted-foreground">{d.est_effort || 0}h · {d.module || '未分模块'}</div>
              <Button size="sm" className="mt-1" onClick={() => importDraft(idx)}>导入看板</Button>
            </Card>
          ))}
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <div className="p-3 border-t flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder="描述你的需求..." onKeyDown={e => { if (e.key === 'Enter') send() }} />
          <Button onClick={send} disabled={loading}>发送</Button>
        </div>
      </Card>
    </div>
  )
}

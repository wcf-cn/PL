import { useState } from 'react'
import { api } from '../api'
import type { ChatMessage, DraftResult } from '../types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card } from './ui/card'
import { Badge } from './ui/badge'

export default function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [draftGroups, setDraftGroups] = useState<DraftResult[]>([])
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
      if (d) setDraftGroups(prev => [...prev, d])
    } catch (e: any) {
      setError(e.response?.data?.detail || 'AI 调用失败')
    } finally {
      setLoading(false)
    }
  }

  const importGroup = async (idx: number) => {
    const g = draftGroups[idx]
    try {
      const parent = await api.requirements.create({ title: g.parent.title, status: 'backlog', priority: 'P1' })
      for (const c of g.children) {
        await api.requirements.create({
          title: c.type ? `[${c.type}] ${c.title}` : c.title,
          status: 'backlog', priority: 'P1', parent: parent.id, note: c.analysis || ''
        })
      }
      setDraftGroups(prev => prev.filter((_, i) => i !== idx))
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
          <span className="font-semibold">AI 分析助手</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>✕</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-60">
          {messages.length === 0 && <div className="text-sm text-muted-foreground">描述你的问题,我帮你分析拆解...如"AB门人数统计漏检"</div>}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <span className={`inline-block px-3 py-1 rounded-lg text-sm whitespace-pre-wrap text-left ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{m.content}</span>
            </div>
          ))}
          {loading && <div className="text-sm text-muted-foreground">分析中...</div>}
          {draftGroups.map((g, idx) => (
            <Card key={idx} className="p-2 bg-amber-50 border-amber-200">
              <div className="font-semibold text-sm">📊 {g.parent.title}</div>
              <div className="text-xs text-muted-foreground mb-1">{g.children.length} 个子任务</div>
              {g.children.map((c, ci) => (
                <div key={ci} className="text-xs mt-1 pl-2 border-l-2 border-amber-300">
                  {c.type && <Badge variant="secondary" className="text-xs mr-1">{c.type}</Badge>}
                  {c.title}
                  {c.analysis && <div className="text-muted-foreground mt-0.5">{c.analysis}</div>}
                </div>
              ))}
              <Button size="sm" className="mt-2" onClick={() => importGroup(idx)}>导入({g.children.length + 1}条)</Button>
            </Card>
          ))}
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <div className="p-3 border-t flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder="描述你的问题..." onKeyDown={e => { if (e.key === 'Enter') send() }} />
          <Button onClick={send} disabled={loading}>发送</Button>
        </div>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { api } from '../api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export default function Login({ onOk }:{ onOk:()=>void }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('')
  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); setErr('')
    try { await api.login(u, p); onOk() }
    catch { setErr('用户名或密码错误') }
  }
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-xs">
        <CardHeader>
          <CardTitle className="text-xl">PL 看板 · 登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={u}
                onChange={e=>setU(e.target.value)}
                placeholder="用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={p}
                onChange={e=>setP(e.target.value)}
                placeholder="密码"
              />
            </div>
            {err && <div className="text-destructive text-sm">{err}</div>}
            <Button type="submit" className="w-full">登录</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

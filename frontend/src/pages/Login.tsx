import { useState } from 'react'
import { api } from '../api'
export default function Login({ onOk }:{ onOk:()=>void }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('')
  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); setErr('')
    try { await api.login(u, p); onOk() }
    catch { setErr('用户名或密码错误') }
  }
  return (
    <form onSubmit={submit} className="max-w-xs mx-auto mt-20 space-y-2">
      <h1 className="text-xl">PL 看板 · 登录</h1>
      <input className="w-full border p-2" value={u} onChange={e=>setU(e.target.value)} placeholder="用户名" />
      <input className="w-full border p-2" type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="密码" />
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <button className="w-full bg-blue-600 text-white p-2 rounded">登录</button>
    </form>
  )
}

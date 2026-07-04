import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api'
import Login from './pages/Login'
import Board from './pages/Board'
import Capacity from './pages/Capacity'
export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => { api.me().then(() => setAuthed(true)).catch(() => setAuthed(false)) }, [])
  if (authed === null) return <div className="p-4">加载中…</div>
  return (
    <HashRouter>
      <div className="p-4">
        <Nav authed={authed} onLogout={async()=>{await api.logout();setAuthed(false)}} />
        <Routes>
          {!authed ? <>
            <Route path="*" element={<Login onOk={()=>setAuthed(true)} />} />
          </> : <>
            <Route path="/board" element={<Board />} />
            <Route path="/capacity" element={<Capacity />} />
            <Route path="*" element={<Navigate to="/board" />} />
          </>}
        </Routes>
      </div>
    </HashRouter>
  )
}
function Nav({authed, onLogout}:{authed:boolean; onLogout:()=>void}) {
  if (!authed) return null
  return <nav className="flex gap-4 mb-4">
    <a href="#/board" className="text-blue-600">看板</a>
    <a href="#/capacity" className="text-blue-600">产能</a>
    <button onClick={onLogout} className="ml-auto text-gray-500">登出</button>
  </nav>
}

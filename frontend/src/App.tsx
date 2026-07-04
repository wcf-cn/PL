import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api'
import Login from './pages/Login'
import Board from './pages/Board'
import Capacity from './pages/Capacity'
import Schedule from './pages/Schedule'
import Burndown from './pages/Burndown'
import Gantt from './pages/Gantt'
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
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/burndown" element={<Burndown />} />
            <Route path="/gantt" element={<Gantt />} />
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
    <a href="#/schedule" className="text-blue-600">排期</a>
    <a href="#/burndown" className="text-blue-600">燃尽</a>
    <a href="#/gantt" className="text-blue-600">甘特</a>
    <button onClick={onLogout} className="ml-auto text-gray-500">登出</button>
  </nav>
}

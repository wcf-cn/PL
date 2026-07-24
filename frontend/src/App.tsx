import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { api } from './api'
import Login from './pages/Login'
import Board from './pages/Board'
import Capacity from './pages/Capacity'
import Schedule from './pages/Schedule'
import Burndown from './pages/Burndown'
import Gantt from './pages/Gantt'
import Team from './pages/Team'
import Versions from './pages/Versions'
import Focus from './pages/Focus'
import Estimation from './pages/Estimation'
import Performance from './pages/Performance'
import { Button } from './components/ui/button'
import { cn } from './lib/utils'
import AssistantWidget from './components/AssistantWidget'

const NAV_ITEMS = [
  { href: '#/board', label: '看板', icon: '📋' },
  { href: '#/capacity', label: '产能', icon: '📊' },
  { href: '#/schedule', label: '排期', icon: '📅' },
  { href: '#/burndown', label: '燃尽', icon: '📉' },
  { href: '#/gantt', label: '甘特', icon: '📊' },
  { href: '#/versions', label: '版本', icon: '🏷️' },
  { href: '#/focus', label: '聚焦', icon: '🚨' },
  { href: '#/estimation', label: '估时', icon: '🎯' },
  { href: '#/performance', label: '效能', icon: '📈' },
  { href: '#/team', label: '团队', icon: '👥' },
]

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => { api.me().then(() => setAuthed(true)).catch(() => setAuthed(false)) }, [])
  if (authed === null) return <div className="p-4">加载中…</div>
  return (
    <HashRouter>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-3 md:p-6">
          {authed && <TopNav onLogout={async()=>{await api.logout();setAuthed(false)}} />}
          <main className="pb-16 md:pb-0">
            <Routes>
              {!authed ? <>
                <Route path="*" element={<Login onOk={()=>setAuthed(true)} />} />
              </> : <>
                <Route path="/board" element={<Board />} />
                <Route path="/capacity" element={<Capacity />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/burndown" element={<Burndown />} />
                <Route path="/gantt" element={<Gantt />} />
                <Route path="/versions" element={<Versions />} />
                <Route path="/focus" element={<Focus />} />
                <Route path="/estimation" element={<Estimation />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/team" element={<Team />} />
                <Route path="*" element={<Navigate to="/board" />} />
              </>}
            </Routes>
          </main>
          {authed && <BottomTabBar />}
          {authed && <AssistantWidget />}
        </div>
      </div>
    </HashRouter>
  )
}

function TopNav({ onLogout }:{ onLogout:()=>void }) {
  const location = useLocation()
  const path = location.pathname
  return (
    <nav className="hidden md:flex items-center justify-between mb-6 border-b pb-4">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold">PL 看板</h1>
        <div className="flex gap-1">
          {NAV_ITEMS.map(item => (
            <a key={item.href} href={item.href} className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              path.includes(item.href.replace('#/', '')) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}>{item.label}</a>
          ))}
        </div>
      </div>
      <Button variant="ghost" onClick={onLogout}>登出</Button>
    </nav>
  )
}

function BottomTabBar() {
  const location = useLocation()
  const path = location.pathname
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex justify-around items-center md:hidden" style={{ height: 56 }}>
      {NAV_ITEMS.map(item => {
        const active = path.includes(item.href.replace('#/', ''))
        return (
          <a key={item.href} href={item.href} className={cn(
            'flex flex-col items-center justify-center flex-1 h-full text-xs gap-0.5',
            active ? 'text-primary font-medium' : 'text-muted-foreground'
          )}>
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        )
      })}
    </nav>
  )
}

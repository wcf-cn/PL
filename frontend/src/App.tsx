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
import { Button } from './components/ui/button'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { cn } from './lib/utils'
import AssistantWidget from './components/AssistantWidget'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => { api.me().then(() => setAuthed(true)).catch(() => setAuthed(false)) }, [])
  if (authed === null) return <div className="p-4">加载中…</div>
  return (
    <HashRouter>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-6">
          <Nav authed={authed} onLogout={async()=>{await api.logout();setAuthed(false)}} />
          <main>
            <Routes>
              {!authed ? <>
                <Route path="*" element={<Login onOk={()=>setAuthed(true)} />} />
              </> : <>
                <Route path="/board" element={<Board />} />
                <Route path="/capacity" element={<Capacity />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/burndown" element={<Burndown />} />
                <Route path="/gantt" element={<Gantt />} />
                <Route path="/team" element={<Team />} />
                <Route path="*" element={<Navigate to="/board" />} />
              </>}
            </Routes>
          </main>
          {authed && <AssistantWidget />}
        </div>
      </div>
    </HashRouter>
  )
}

function Nav({authed, onLogout}:{authed:boolean; onLogout:()=>void}) {
  const location = useLocation()
  const path = location.pathname

  if (!authed) return null

  const navItems = [
    { href: '#/board', label: '看板' },
    { href: '#/capacity', label: '产能' },
    { href: '#/schedule', label: '排期' },
    { href: '#/burndown', label: '燃尽' },
    { href: '#/gantt', label: '甘特' },
    { href: '#/team', label: '团队' },
  ]

  return (
    <nav className="flex items-center justify-between mb-6 border-b pb-4">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold">PL 看板</h1>
        <Tabs value={path.replace('#/', '') || 'board'}>
          <TabsList>
            {navItems.map(item => (
              <TabsTrigger
                key={item.href}
                value={item.href.replace('#/', '')}
                asChild
              >
                <a href={item.href} className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  path.replace('#/', '') === item.href.replace('#/', '')
                    ? 'text-foreground bg-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}>
                  {item.label}
                </a>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <Button variant="ghost" onClick={onLogout}>登出</Button>
    </nav>
  )
}

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
import Roadmap from './pages/Roadmap'
import Focus from './pages/Focus'
import Estimation from './pages/Estimation'
import Performance from './pages/Performance'
import { Button } from './components/ui/button'
import { cn } from './lib/utils'
import AssistantWidget from './components/AssistantWidget'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './components/ui/dropdown-menu'

const NAV_ITEMS = [
  { href: '#/board', label: '看板', icon: '📋' },
  { href: '#/capacity', label: '产能', icon: '📊' },
  { href: '#/schedule', label: '排期', icon: '📅' },
  { href: '#/burndown', label: '燃尽', icon: '📉' },
  { href: '#/gantt', label: '甘特', icon: '📊' },
  { href: '#/versions', label: '版本', icon: '🏷️' },
  { href: '#/roadmap', label: '路线', icon: '🛣️' },
  { href: '#/focus', label: '聚焦', icon: '🚨' },
  { href: '#/estimation', label: '估时', icon: '🎯' },
  { href: '#/performance', label: '效能', icon: '📈' },
  { href: '#/team', label: '团队', icon: '👥' },
]
// 移动端底部高频 5 项,其余收进"更多"
const MOBILE_PRIMARY = ['board', 'focus', 'capacity', 'versions', 'team']

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
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/focus" element={<Focus />} />
                <Route path="/estimation" element={<Estimation />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/team" element={<Team />} />
                <Route path="*" element={<Navigate to="/focus" />} />
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
  const primary = NAV_ITEMS.filter(it => MOBILE_PRIMARY.includes(it.href.replace('#/', '')))
  const rest = NAV_ITEMS.filter(it => !MOBILE_PRIMARY.includes(it.href.replace('#/', '')))
  const tabCls = (active: boolean) => cn(
    'flex flex-col items-center justify-center flex-1 h-full text-xs gap-0.5',
    active ? 'text-primary font-medium' : 'text-muted-foreground'
  )
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex justify-around items-center md:hidden" style={{ height: 56 }}>
      {primary.map(item => {
        const active = path.includes(item.href.replace('#/', ''))
        return (
          <a key={item.href} href={item.href} className={tabCls(active)}>
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        )
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={tabCls(false)}>
            <span className="text-base leading-none">⋯</span>
            <span>更多</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="mb-1">
          {rest.map(item => (
            <DropdownMenuItem key={item.href} asChild>
              <a href={item.href}>{item.icon} {item.label}</a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}

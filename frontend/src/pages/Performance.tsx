import { useEffect, useState } from 'react'
import { api } from '../api'
import type { FlowMetrics } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, AreaChart, Area, Legend } from 'recharts'

const CFD_KEYS = ['backlog', 'scheduled', 'in_progress', 'testing', 'done', 'blocked', 'paused'] as const
const CFD_COLORS: Record<string, string> = {
  backlog: '#94a3b8', scheduled: '#3b82f6', in_progress: '#eab308',
  testing: '#a855f7', done: '#22c55e', blocked: '#ef4444', paused: '#64748b',
}

export default function Performance() {
  const [data, setData] = useState<FlowMetrics | null>(null)
  useEffect(() => { api.metricsFlow().then(setData) }, [])
  if (!data) return <Card><CardContent className="p-6 text-sm text-muted-foreground">加载中…</CardContent></Card>
  const median = data.cycletime.length ? data.cycletime.map(c => c.hours).sort((a, b) => a - b)[Math.floor(data.cycletime.length / 2)] : 0
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>吞吐量(每周完成)</CardTitle></CardHeader>
        <CardContent>
          {data.throughput.length === 0 ? <div className="text-sm text-muted-foreground">暂无数据(完成需求后开始积累)</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.throughput}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="完成数" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>周期时间(in_progress→done,小时)</CardTitle></CardHeader>
        <CardContent>
          {data.cycletime.length === 0 ? <div className="text-sm text-muted-foreground">暂无已完成需求数据</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="id" name="需求" tick={{ fontSize: 10 }} />
                <YAxis dataKey="hours" name="小时" tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={data.cycletime} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
          {data.cycletime.length > 0 && <div className="text-xs text-muted-foreground mt-1">中位周期: {median}h</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>累积流量图</CardTitle></CardHeader>
        <CardContent>
          {data.cfd.length === 0 ? <div className="text-sm text-muted-foreground">暂无历史(上线后开始积累)</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.cfd}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {CFD_KEYS.map(k => <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={CFD_COLORS[k]} fill={CFD_COLORS[k]} />)}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

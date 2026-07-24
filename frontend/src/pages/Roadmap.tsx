import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Version } from '../types'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

function parse(d: string | null) { return d ? new Date(d).getTime() : null }

export default function Roadmap() {
  const [versions, setVersions] = useState<Version[]>([])
  useEffect(() => { api.versions.list().then(setVersions) }, [])

  const dated = versions.filter(v => parse(v.integration_date) || parse(v.release_date) || parse(v.freeze_date) || parse(v.test_date))
  const times = dated.flatMap(v => [v.integration_date, v.freeze_date, v.test_date, v.release_date].map(parse).filter((x): x is number => x !== null))
  const minT = times.length ? Math.min(...times) : 0
  const maxT = times.length ? Math.max(...times) : 1
  const span = Math.max(1, maxT - minT)

  return (
    <Card>
      <CardHeader><CardTitle>路线图</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {dated.length === 0 && <div className="text-sm text-muted-foreground">暂无带日期的版本</div>}
        {dated.map(v => {
          const start = parse(v.integration_date) || parse(v.freeze_date) || parse(v.test_date) || parse(v.release_date) || minT
          const end = parse(v.release_date) || parse(v.test_date) || parse(v.freeze_date) || parse(v.integration_date) || start
          const left = ((start - minT) / span) * 100
          const width = Math.max(3, ((end - start) / span) * 100)
          return (
            <div key={v.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm font-medium truncate">{v.name}</span>
              <div className="relative flex-1 h-6 bg-muted/40 rounded">
                <div className="absolute h-6 rounded bg-primary/30 border border-primary/50 flex items-center px-1"
                     style={{ left: `${left}%`, width: `${width}%` }}>
                  <Badge variant="outline" className="text-[10px]">{v.current_phase}</Badge>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

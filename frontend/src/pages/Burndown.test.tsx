import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Burndown from './Burndown'

vi.mock('../api', () => ({
  api: {
    requirements: { list: vi.fn().mockResolvedValue([]) },
    members: { list: vi.fn().mockResolvedValue([{ id:1, name:'张三', week_capacity:40, modules:'', active:true }]) },
    snapshots: vi.fn().mockResolvedValue([]),
  },
}))

describe('Burndown', () => {
  it('无需求时显示提示', async () => {
    render(<Burndown />)
    await waitFor(() => expect(screen.getByText('暂无需求数据')).toBeInTheDocument())
  })

  it('父需求工时不 double-count,只算叶子', async () => {
    const { api } = await import('../api')
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'父', status:'in_progress', assignee:1, est_effort:20, actual_effort:0, planned_start:'2026-07-01', planned_end:'2026-07-10', parent:null, module:'', progress:0, note:'' },
      { id:2, title:'子A', status:'in_progress', assignee:1, est_effort:6, actual_effort:0, planned_start:'2026-07-01', planned_end:'2026-07-10', parent:1, module:'', progress:0, note:'' },
      { id:3, title:'子B', status:'in_progress', assignee:1, est_effort:6, actual_effort:0, planned_start:'2026-07-01', planned_end:'2026-07-10', parent:1, module:'', progress:0, note:'' },
    ])
    render(<Burndown />)
    // 在途总工时 = 只算叶子 6+6 = 12h(父的 20h 被排除,不是 32h)
    await waitFor(() => expect(screen.getAllByText(/12h/).length).toBeGreaterThan(0))
  })
})

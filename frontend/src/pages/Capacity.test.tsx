import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import Capacity from './Capacity'

vi.mock('../api', () => ({
  api: {
    requirements: { list: vi.fn().mockResolvedValue([]) },
    members: { list: vi.fn().mockResolvedValue([{ id:1, name:'张三', week_capacity:40, modules:'', active:true }]) },
  },
}))

describe('Capacity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染成员行', async () => {
    render(<Capacity />)
    await waitFor(() => expect(screen.getAllByText('张三').length).toBeGreaterThan(0))
  })

  it('父需求工时不 double-count,未排期列只算叶子', async () => {
    const { api } = await import('../api')
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'父', status:'in_progress', assignee:1, est_effort:20, actual_effort:0, planned_start:null, planned_end:null, parent:null, module:'', progress:0, note:'' },
      { id:2, title:'子', status:'in_progress', assignee:1, est_effort:8, actual_effort:0, planned_start:null, planned_end:null, parent:1, module:'', progress:0, note:'' },
    ])
    render(<Capacity />)
    // 未排期列只算叶子 8h(不是 28h)
    await waitFor(() => expect(screen.getAllByText('8').length).toBeGreaterThan(0))
    expect(screen.queryByText('28')).not.toBeInTheDocument()
  })

  it('productivity 折算后,峰值负载触发红色', async () => {
    const { api } = await import('../api')
    // est=24 排在 07-07~07-11(4天,不含今天): daily=6, peakWeekly=30
    // 名义 40 → 不折算 peakUtil=30/40=0.75(不红); 折算 effectiveCap=28 → 30/28=1.07(红)
    ;(api.requirements.list as any).mockResolvedValue([
      { id:1, title:'需求', status:'in_progress', assignee:1, est_effort:24, actual_effort:0, planned_start:'2026-07-07', planned_end:'2026-07-11', parent:null, module:'', progress:0, note:'' },
    ])
    render(<Capacity />)
    const peakCell = await waitFor(() => screen.getByText('30'))
    expect(peakCell.className).toContain('text-red-600')
  })

  it('本周负载按实际重叠天数精确计算', { timeout: 10000 }, async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-22T00:00:00'))
    const { api } = await import('../api')
    // 需求 07-20..07-22(3 天 inclusive), est=12 → daily=6 (12/2), 与本周重叠 3 天 → 18h
    const mockData = [
      { id:1, title:'R', status:'in_progress', assignee:1, est_effort:12, actual_effort:0, planned_start:'2026-07-20', planned_end:'2026-07-22', parent:null, module:'', progress:0, note:'' },
    ]
    ;(api.requirements.list as any).mockImplementation(() => Promise.resolve(mockData))
    await act(async () => {
      render(<Capacity />)
      await vi.runAllTimersAsync()
    })
    // With precise overlap calculation: daily 6 × 3 overlap days = 18
    // Old coarse calc would have been: daily 6 × 5 = 30
    expect(screen.getAllByText('18').length).toBeGreaterThan(0)
    vi.useRealTimers()
  })
})

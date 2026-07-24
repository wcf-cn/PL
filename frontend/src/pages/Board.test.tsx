import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Board from './Board'

vi.mock('../api', () => ({
  api: {
    requirements: {
      list: vi.fn().mockResolvedValue([
        { id:1, title:'登录', status:'in_progress', priority:'P0', assignee:1, assignee_name:'张三', module:'', est_effort:8, actual_effort:4, progress:50, planned_start:'2026-01-01', planned_end:'2026-01-15', parent:null, version:null, blocked_by:[], last_status_change_at:null, created_at:'', note:'' },
      ]),
      update: vi.fn().mockResolvedValue({ id:1, title:'登录', status:'in_progress', priority:'P0', assignee:1, assignee_name:'张三', module:'', est_effort:8, actual_effort:4, progress:50, planned_start:'2026-01-01', planned_end:'2026-01-15', parent:null, version:null, blocked_by:[], last_status_change_at:null, created_at:'', note:'' }),
      create: vi.fn().mockResolvedValue({ id:99, title:'新需求', status:'backlog', priority:'P1', assignee:1, assignee_name:'张三', module:'', est_effort:4, actual_effort:0, progress:0, planned_start:null, planned_end:null, parent:null, version:null, blocked_by:[], last_status_change_at:null, created_at:'', note:'' }),
    },
    members: { list: vi.fn().mockResolvedValue([
      { id:1, name:'张三', week_capacity:40, modules:'', active:true },
      { id:2, name:'李四', week_capacity:40, modules:'', active:true },
    ])},
    milestones: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id:1, requirement:1, title:'M1', date:'2026-01-01', note:'', created_at:'2026-01-01T00:00:00Z' }),
    },
    versions: { list: vi.fn().mockResolvedValue([]) },
  }
}))

describe('Board', () => {
  it('renders columns and cards', async () => {
    render(<Board />)
    await waitFor(() => expect(screen.getByText('登录')).toBeInTheDocument())
    expect(screen.getByText('开发中')).toBeInTheDocument()
  })

  it('超期需求显示红色角标', async () => {
    const { api } = await import('../api')
    const past = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0]
    ;(api.requirements.list as any).mockResolvedValueOnce([
      { id:1, title:'延期需求', status:'in_progress', priority:'P1', assignee:1, assignee_name:'张三', module:'', est_effort:8, actual_effort:2, progress:25, planned_start:'2026-07-01', planned_end:past, parent:null, version:null, blocked_by:[], last_status_change_at:null, created_at:'', note:'' },
    ])
    render(<Board />)
    await waitFor(() => expect(screen.getByText('延期需求')).toBeInTheDocument())
    expect(screen.getByText(/超期/)).toBeInTheDocument()
  })

  it('creates a new requirement', async () => {
    const { api } = await import('../api')
    render(<Board />)
    await waitFor(() => expect(screen.getByText('+ 新建需求')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.click(screen.getByText('+ 新建需求'))
    await user.type(screen.getByPlaceholderText('请输入标题'), '新需求')
    await user.click(screen.getByRole('button', { name: '提交' }))
    await waitFor(() => {
      expect(api.requirements.create).toHaveBeenCalledWith({
        title: '新需求', status: 'backlog', priority: 'P1', assignee: null, module: '',
        est_effort: 0, actual_effort: 0, progress: 0, planned_start: null, planned_end: null,
      })
    })
    await waitFor(() => expect(screen.getByText('新需求')).toBeInTheDocument())
  })

  it('opens edit form on double-click', async () => {
    render(<Board />)
    await waitFor(() => expect(screen.getByText('登录')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.dblClick(screen.getByText('登录'))
    await waitFor(() => expect(screen.getByDisplayValue('登录')).toBeInTheDocument())
    expect(screen.getByText('编辑需求')).toBeInTheDocument()
    expect(screen.getByText('已投入时间h')).toBeInTheDocument()
    expect(screen.getByText('进度')).toBeInTheDocument()
  })

  it('状态停留超7天显示卡顿角标', async () => {
    const { api } = await import('../api')
    const old = new Date(Date.now() - 86400000 * 10).toISOString()
    ;(api.requirements.list as any).mockResolvedValueOnce([
      { id:1, title:'卡住的需求', status:'in_progress', priority:'P1', assignee:1, assignee_name:'张三', module:'', est_effort:8, actual_effort:1, progress:25, planned_start:null, planned_end:null, parent:null, version:null, blocked_by:[], last_status_change_at:old, created_at:old, note:'' },
    ])
    render(<Board />)
    await waitFor(() => expect(screen.getByText('卡住的需求')).toBeInTheDocument())
    expect(screen.getByText(/卡 \d+天/)).toBeInTheDocument()
  })
})

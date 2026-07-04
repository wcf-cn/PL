import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Board from './Board'

vi.mock('../api', () => ({
  api: {
    requirements: {
      list: vi.fn().mockResolvedValue([
        { id:1, title:'登录', status:'in_progress', priority:'P0', assignee_name:'张三', est_effort:8, actual_effort:4, progress:30, planned_start:'2026-01-01', planned_end:'2026-01-15' },
      ]),
      update: vi.fn().mockResolvedValue({ id:1, title:'登录', status:'in_progress', priority:'P0', assignee_name:'张三', est_effort:8, actual_effort:4, progress:30, planned_start:'2026-01-01', planned_end:'2026-01-15' }),
      create: vi.fn().mockResolvedValue({ id:99, title:'新需求', status:'backlog', priority:'P1', assignee:1, assignee_name:'张三', module:'', est_effort:4, actual_effort:0, progress:0, planned_start:null, planned_end:null, assigned_sprint:null }),
    },
    members: { list: vi.fn().mockResolvedValue([
      { id:1, name:'张三', week_capacity:40, modules:'', active:true },
      { id:2, name:'李四', week_capacity:40, modules:'', active:true },
    ])},
    sprints: { list: vi.fn().mockResolvedValue([
      { id:1, name:'S1', start_date:'2026-01-01', end_date:'2026-01-14', is_active:true, weeks:2 },
    ])},
    milestones: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id:1, requirement:1, title:'M1', date:'2026-01-01', note:'', created_at:'2026-01-01T00:00:00Z' }),
    },
  }
}))

describe('Board', () => {
  it('renders columns and cards', async () => {
    render(<Board />)
    await waitFor(() => expect(screen.getByText('登录')).toBeInTheDocument())
    expect(screen.getByText('开发中')).toBeInTheDocument()
  })

  it('creates a new requirement', async () => {
    const { api } = await import('../api')
    render(<Board />)

    await waitFor(() => expect(screen.getByText('+ 新建需求')).toBeInTheDocument())

    const user = userEvent.setup()
    await user.click(screen.getByText('+ 新建需求'))

    const titleInput = screen.getByPlaceholderText('请输入标题')
    await user.type(titleInput, '新需求')

    const submitButton = screen.getByRole('button', { name: '提交' })
    await user.click(submitButton)

    await waitFor(() => {
      expect(api.requirements.create).toHaveBeenCalledWith({
        title: '新需求',
        status: 'backlog',
        priority: 'P1',
        assignee: null,
        module: '',
        est_effort: 0,
        actual_effort: 0,
        progress: 0,
        planned_start: null,
        planned_end: null,
        assigned_sprint: null
      })
    })

    await waitFor(() => {
      expect(screen.getByText('新需求')).toBeInTheDocument()
    })
  })

  it('opens edit form on double-click', async () => {
    render(<Board />)

    await waitFor(() => expect(screen.getByText('登录')).toBeInTheDocument())

    const user = userEvent.setup()
    const loginCard = screen.getByText('登录')
    await user.dblClick(loginCard)

    await waitFor(() => {
      expect(screen.getByDisplayValue('登录')).toBeInTheDocument()
    })
    expect(screen.getByText('编辑需求')).toBeInTheDocument()

    // Check that the new fields appear in the edit form
    expect(screen.getByText('已投入时间h')).toBeInTheDocument()
    expect(screen.getByText('进度%')).toBeInTheDocument()
    expect(screen.getByText('计划开始')).toBeInTheDocument()
    expect(screen.getByText('计划结束')).toBeInTheDocument()
  })
})
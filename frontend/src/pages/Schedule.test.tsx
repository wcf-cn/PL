import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Schedule from './Schedule'

vi.mock('../api', () => ({
  api: {
    members: {
      list: vi.fn().mockResolvedValue([
        { id: 1, name: '张三', week_capacity: 40, modules: '', active: true },
        { id: 2, name: '李四', week_capacity: 40, modules: '', active: true },
        { id: 3, name: '王五', week_capacity: 40, modules: '', active: false },
      ]),
    },
    sprints: {
      list: vi.fn().mockResolvedValue([
        { id: 1, name: 'S1', start_date: '2026-01-01', end_date: '2026-01-14', is_active: true, weeks: 2 },
        { id: 2, name: 'S2', start_date: '2026-01-15', end_date: '2026-01-28', is_active: false, weeks: 2 },
      ]),
    },
    requirements: {
      list: vi.fn().mockResolvedValue([
        {
          id: 1,
          title: '用户登录',
          status: 'in_progress',
          priority: 'P0',
          assignee: 1,
          assignee_name: '张三',
          module: 'auth',
          progress: 50,
          est_effort: 8,
          actual_effort: 4,
          assigned_sprint: 1,
          planned_start: '2026-01-01',
          planned_end: '2026-01-05',
          note: ''
        },
        {
          id: 2,
          title: '数据导出',
          status: 'scheduled',
          priority: 'P1',
          assignee: 1,
          assignee_name: '张三',
          module: 'export',
          progress: 10,
          est_effort: 12,
          actual_effort: 0,
          assigned_sprint: 1,
          planned_start: '2026-01-06',
          planned_end: '2026-01-10',
          note: ''
        },
        {
          id: 3,
          title: '权限管理',
          status: 'backlog',
          priority: 'P2',
          assignee: 2,
          assignee_name: '李四',
          module: 'auth',
          progress: 0,
          est_effort: 6,
          actual_effort: 0,
          assigned_sprint: 1,
          planned_start: '2026-01-03',
          planned_end: '2026-01-08',
          note: ''
        },
        {
          id: 4,
          title: '旧需求',
          status: 'done',
          priority: 'P1',
          assignee: 3,
          assignee_name: '王五',
          module: 'legacy',
          progress: 100,
          est_effort: 4,
          actual_effort: 4,
          assigned_sprint: 2,
          planned_start: '2026-01-15',
          planned_end: '2026-01-16',
          note: ''
        },
      ]),
    },
  },
}))

describe('Schedule', () => {
  it('renders schedule view with active sprint by default', async () => {
    render(<Schedule />)

    await waitFor(() => {
      expect(screen.getByText('排期')).toBeInTheDocument()
    })

    // Should show sprint selector with active sprint selected
    await waitFor(() => {
      expect(screen.getByText('选择迭代')).toBeInTheDocument()
    })

    // Should show active members (张三, 李四) but not inactive (王五)
    expect(screen.getByText('张三')).toBeInTheDocument()
    expect(screen.getByText('李四')).toBeInTheDocument()
    expect(screen.queryByText('王五')).not.toBeInTheDocument()

    // Should show requirements for active sprint
    expect(screen.getByText('用户登录')).toBeInTheDocument()
    expect(screen.getByText('数据导出')).toBeInTheDocument()
    expect(screen.getByText('权限管理')).toBeInTheDocument()

    // Should not show requirements from other sprints
    expect(screen.queryByText('旧需求')).not.toBeInTheDocument()
  })

  it('groups requirements by assignee', async () => {
    render(<Schedule />)

    await waitFor(() => {
      expect(screen.getByText('张三')).toBeInTheDocument()
      expect(screen.getByText('李四')).toBeInTheDocument()
    })

    // 张三 should have 2 requirements
    await waitFor(() => {
      const zhangSanSection = screen.getByText('张三').parentElement
      expect(zhangSanSection).toBeInTheDocument()
      expect(screen.getByText('用户登录')).toBeInTheDocument()
      expect(screen.getByText('数据导出')).toBeInTheDocument()
    })

    // 李四 should have 1 requirement
    expect(screen.getByText('权限管理')).toBeInTheDocument()
  })

  it('shows requirement details including status and effort', async () => {
    render(<Schedule />)

    await waitFor(() => {
      expect(screen.getByText('用户登录')).toBeInTheDocument()
    })

    // Should show status labels
    expect(screen.getByText('开发中')).toBeInTheDocument()
    expect(screen.getByText('排期中')).toBeInTheDocument()
    expect(screen.getByText('待评审')).toBeInTheDocument()

    // Should show effort information
    expect(screen.getByText(/预计.*8h.*已投.*4h/)).toBeInTheDocument()
  })

  it('can switch between sprints', async () => {
    render(<Schedule />)

    await waitFor(() => {
      expect(screen.getByText('选择迭代')).toBeInTheDocument()
    })

    const selectElement = screen.getByRole('combobox')
    expect(selectElement).toHaveValue('1')

    // Verify the options include both sprints
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3) // 未选择 + S1 + S2
  })
})
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Schedule from './Schedule'

vi.mock('../api', () => ({
  api: {
    members: {
      list: vi.fn().mockResolvedValue([
        { id: 1, name: '张三', week_capacity: 40, modules: '', active: true },
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
          planned_start: '2026-07-01',
          planned_end: '2026-07-05',
          note: '',
          parent: null
        },
      ]),
    },
  },
}))

describe('Schedule', () => {
  it('renders schedule title and member', async () => {
    render(<Schedule />)

    await waitFor(() => expect(screen.getByText(/排期/)).toBeInTheDocument())
    expect(screen.getByText('张三')).toBeInTheDocument()
  })

  it('renders requirement title', async () => {
    render(<Schedule />)

    await waitFor(() => expect(screen.getByText('用户登录')).toBeInTheDocument())
  })
})
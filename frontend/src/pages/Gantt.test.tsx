import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Gantt from './Gantt'

vi.mock('../api', () => ({
  api: {
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

describe('Gantt', () => {
  it('renders gantt title and requirement', async () => {
    render(<Gantt />)

    await waitFor(() => expect(screen.getByText('甘特图')).toBeInTheDocument())
    expect(screen.getByText('用户登录')).toBeInTheDocument()
  })
})

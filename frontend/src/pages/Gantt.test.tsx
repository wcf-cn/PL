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
    versions: {
      list: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'v2.0',
          integration_date: '2026-07-01',
          freeze_date: '2026-07-03',
          test_date: null,
          release_date: null,
          note: '',
          current_phase: '联调中',
          created_at: '',
          updated_at: ''
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

  it('版本节点 label 带版本名', async () => {
    render(<Gantt />)
    await waitFor(() => expect(screen.getByText('甘特图')).toBeInTheDocument())
    expect(screen.getByText(/v2\.0.*联调/)).toBeInTheDocument()
  })
})

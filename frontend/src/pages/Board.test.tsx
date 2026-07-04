import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Board from './Board'
vi.mock('../api', () => ({
  api: {
    requirements: {
      list: vi.fn().mockResolvedValue([
        { id:1, title:'登录', status:'in_progress', priority:'P0', assignee_name:'张三', est_effort:8, progress:30 },
      ]),
      update: vi.fn(),
    },
    sprints: { list: vi.fn().mockResolvedValue([{ id:1, name:'S1', start_date:'', end_date:'', is_active:true, weeks:2 }]) },
  }
}))
describe('Board', () => {
  it('renders columns and cards', async () => {
    render(<Board />)
    await waitFor(() => expect(screen.getByText('登录')).toBeInTheDocument())
    expect(screen.getByText('开发中')).toBeInTheDocument()
  })
})
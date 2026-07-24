import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Focus from './Focus'

vi.mock('../api', () => ({
  api: {
    requirements: { list: vi.fn().mockResolvedValue([
      { id:1, title:'超期A', status:'in_progress', planned_end:'2020-01-01', est_effort:8, actual_effort:2, assignee:1, assignee_name:'张三', module:'', priority:'P1', parent:null, version:null, blocked_by:[], note:'' },
    ])},
    members: { list: vi.fn().mockResolvedValue([{ id:1, name:'张三', week_capacity:40, modules:'', active:true }]) },
    versions: { list: vi.fn().mockResolvedValue([]) },
  },
}))

describe('Focus', () => {
  it('列出超期风险', async () => {
    render(<Focus />)
    await waitFor(() => expect(screen.getByText('超期A')).toBeInTheDocument())
    expect(screen.getAllByText(/超期/).length).toBeGreaterThanOrEqual(1)
  })
})

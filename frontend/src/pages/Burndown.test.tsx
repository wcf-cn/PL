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
})

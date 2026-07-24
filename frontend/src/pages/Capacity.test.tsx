import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Capacity from './Capacity'

vi.mock('../api', () => ({
  api: {
    requirements: { list: vi.fn().mockResolvedValue([]) },
    members: { list: vi.fn().mockResolvedValue([{ id:1, name:'张三', week_capacity:40, modules:'', active:true }]) },
  },
}))

describe('Capacity', () => {
  it('渲染成员行', async () => {
    render(<Capacity />)
    await waitFor(() => expect(screen.getAllByText('张三').length).toBeGreaterThan(0))
  })
})

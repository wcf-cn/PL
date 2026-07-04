import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Capacity from './Capacity'
vi.mock('../api', () => ({
  api: {
    sprints: { list: vi.fn().mockResolvedValue([{ id:1, name:'S1', start_date:'', end_date:'', is_active:true, weeks:2 }]) },
    capacity: vi.fn().mockResolvedValue([
      { member_id:1, member:'张三', capacity:80, load:90, utilization:1.125 },
      { member_id:2, member:'李四', capacity:80, load:40, utilization:0.5 },
    ]),
  }
}))
describe('Capacity', () => {
  it('shows utilization sorted desc with color', async () => {
    render(<Capacity />)
    await waitFor(() => fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } }))
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument())
    expect(screen.getByText('112.5%')).toBeInTheDocument()
  })
})
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Gantt from './Gantt'
vi.mock('../api', () => ({
  api: {
    sprints: { list: vi.fn().mockResolvedValue([{ id:1, name:'S1', start_date:'', end_date:'', is_active:true, weeks:2 }]) },
    requirements: { list: vi.fn().mockResolvedValue([
      { id:1, title:'Task1', status:'in_progress', est_effort:10, planned_start:'2026-07-01', planned_end:'2026-07-05', assigned_sprint:1 },
      { id:2, title:'Task2', status:'done', est_effort:5, planned_start:'2026-07-03', planned_end:'2026-07-07', assigned_sprint:1 },
    ])},
  },
}))
describe('Gantt', () => {
  it('shows requirement title in timeline', async () => {
    render(<Gantt />)
    await waitFor(() => fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } }))
    await waitFor(() => expect(screen.getByText('Task1')).toBeInTheDocument())
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Burndown from './Burndown'
vi.mock('../api', () => ({
  api: {
    sprints: { list: vi.fn().mockResolvedValue([{ id:1, name:'S1', start_date:'2026-07-01', end_date:'2026-07-14', is_active:true, weeks:2 }]) },
    requirements: { list: vi.fn().mockResolvedValue([
      { id:1, title:'Task1', status:'in_progress', est_effort:10, planned_start:null, planned_end:null, assigned_sprint:1 },
      { id:2, title:'Task2', status:'done', est_effort:5, planned_start:null, planned_end:null, assigned_sprint:1 },
    ])},
  },
}))
describe('Burndown', () => {
  it('shows total and remaining hours', async () => {
    render(<Burndown />)
    await waitFor(() => fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } }))
    await waitFor(() => expect(screen.getByText(/总工时.*h/)).toBeInTheDocument())
    expect(screen.getByText(/剩余.*h/)).toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Burndown from './Burndown'

vi.mock('../api', () => ({
  api: {
    sprints: {
      list: vi.fn().mockResolvedValue([
        { id: 1, name: 'S1', start_date: '2026-07-01', end_date: '2026-07-14', is_active: true, weeks: 2 }
      ])
    },
    burndown: vi.fn().mockResolvedValue({
      sprint: { id: 1, name: 'S1', start_date: '2026-07-01', end_date: '2026-07-14' },
      total_effort: 15,
      snapshots: [
        { date: '2026-07-01', remaining_effort: 15 },
        { date: '2026-07-04', remaining_effort: 10 },
        { date: '2026-07-08', remaining_effort: 5 }
      ]
    })
  },
}))

describe('Burndown', () => {
  it('shows total effort and displays burndown chart', async () => {
    render(<Burndown />)
    await waitFor(() => expect(screen.getByText(/总工时 15h/)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('燃尽图')).toBeInTheDocument())
  })
})

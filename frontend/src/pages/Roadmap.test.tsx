import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Roadmap from './Roadmap'

vi.mock('../api', () => ({
  api: {
    versions: { list: vi.fn().mockResolvedValue([
      { id:1, name:'v1.0', integration_date:'2026-07-01', freeze_date:'2026-07-10', test_date:'2026-07-12', release_date:'2026-07-20', note:'', current_phase:'已发布', created_at:'', updated_at:'' },
    ])},
  },
}))

describe('Roadmap', () => {
  it('渲染版本名与标题', async () => {
    render(<Roadmap />)
    await waitFor(() => expect(screen.getByText('路线图')).toBeInTheDocument())
    expect(screen.getByText('v1.0')).toBeInTheDocument()
  })
})

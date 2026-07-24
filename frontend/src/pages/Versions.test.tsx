import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Versions from './Versions'

vi.mock('../api', () => ({
  api: {
    versions: { list: vi.fn().mockResolvedValue([
      { id:1, name:'v1.0', integration_date:'2026-07-01', freeze_date:'2026-07-10', test_date:'2026-07-12', release_date:'2026-07-20', note:'', current_phase:'已发布', created_at:'', updated_at:'' },
    ])},
    requirements: { list: vi.fn().mockResolvedValue([
      { id:1, title:'A', status:'done', version:1, est_effort:8, actual_effort:8, parent:null },
      { id:2, title:'B', status:'in_progress', version:1, est_effort:4, actual_effort:1, parent:null },
    ])},
  },
}))

describe('Versions', () => {
  it('渲染版本名、当前阶段、进度', async () => {
    render(<Versions />)
    await waitFor(() => expect(screen.getByText('v1.0')).toBeInTheDocument())
    expect(screen.getByText('已发布')).toBeInTheDocument()
    // 2 个需求,1 已上线 → 进度 50%
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })
})

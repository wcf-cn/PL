import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Performance from './Performance'

vi.mock('../api', () => ({
  api: {
    metricsFlow: vi.fn().mockResolvedValue({
      throughput: [{ week: '2026-W30', count: 3 }],
      cycletime: [{ id: 1, title: 'A', hours: 12.5 }],
      cfd: [{ date: '2026-07-20', backlog: 1, scheduled: 0, in_progress: 0, testing: 0, done: 0, blocked: 0, paused: 0 }],
    }),
  },
}))

describe('Performance', () => {
  it('渲染三图标题与样本数据', async () => {
    render(<Performance />)
    await waitFor(() => expect(screen.getByText('吞吐量(每周完成)')).toBeInTheDocument())
    expect(screen.getByText('周期时间(in_progress→done,小时)')).toBeInTheDocument()
    expect(screen.getByText('累积流量图')).toBeInTheDocument()
  })
})

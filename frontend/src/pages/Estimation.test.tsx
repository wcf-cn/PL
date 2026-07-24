import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Estimation from './Estimation'

vi.mock('../api', () => ({
  api: {
    requirements: { list: vi.fn().mockResolvedValue([
      { id:1, title:'A', status:'done', assignee:1, assignee_name:'张三', module:'后端', est_effort:10, actual_effort:18, parent:null },
      { id:2, title:'B', status:'done', assignee:1, assignee_name:'张三', module:'后端', est_effort:5, actual_effort:4, parent:null },
      { id:3, title:'C', status:'in_progress', assignee:1, assignee_name:'张三', module:'后端', est_effort:8, actual_effort:2, parent:null },
    ])},
  },
}))

describe('Estimation', () => {
  it('按人聚合 done 的 est/actual 与偏差', async () => {
    render(<Estimation />)
    await waitFor(() => expect(screen.getByText('张三')).toBeInTheDocument())
    // 只算 2 个 done:Σest=15, Σactual=22, 偏差 22/15≈1.47
    expect(screen.getAllByText('15').length).toBeGreaterThan(0)
    expect(screen.getAllByText('22').length).toBeGreaterThan(0)
  })
})

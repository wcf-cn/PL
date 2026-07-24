import { describe, it, expect } from 'vitest'
import { STATUS_LABEL } from './types'

describe('types after Wave 1 cleanup', () => {
  it('status labels intact', () => {
    expect(STATUS_LABEL.in_progress).toBe('开发中')
  })
  it('calcProgress is removed (no longer exported)', async () => {
    const mod = await import('./types')
    expect((mod as any).calcProgress).toBeUndefined()
  })
})

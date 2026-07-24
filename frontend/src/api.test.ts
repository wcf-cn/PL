import { describe, it, expect } from 'vitest'
import { api } from './api'

describe('api', () => {
  it('exposes requirements crud', () => {
    expect(typeof api.requirements.list).toBe('function')
  })
})

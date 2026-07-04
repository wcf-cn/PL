import { describe, it, expect } from 'vitest'
import { api } from './api'
describe('api.urls', () => {
  it('exposes capacity url builder', () => {
    expect(typeof api.capacity).toBe('function')
  })
})

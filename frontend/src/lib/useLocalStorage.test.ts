import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from './useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => { try { localStorage.removeItem('uls:k') } catch { /* jsdom quirk */ } })

  it('无存储时返回初始值', () => {
    const { result } = renderHook(() => useLocalStorage('uls:k', 'init'))
    expect(result.current[0]).toBe('init')
  })

  it('set 后再挂载能读到持久化值', () => {
    const h1 = renderHook(() => useLocalStorage('uls:k', 'init'))
    act(() => h1.result.current[1]('saved'))
    const h2 = renderHook(() => useLocalStorage('uls:k', 'init'))
    expect(h2.result.current[0]).toBe('saved')
  })
})

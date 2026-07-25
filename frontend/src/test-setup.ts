import '@testing-library/jest-dom'

// ponytail: minimal ResizeObserver polyfill for tests (Gantt.tsx uses it)
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

// ponytail: Radix UI (Select 等)依赖 Pointer Events API,jsdom 未实现 → 测试里补桩
globalThis.Element.prototype.hasPointerCapture = () => false
globalThis.Element.prototype.setPointerCapture = () => {}
globalThis.Element.prototype.releasePointerCapture = () => {}
globalThis.Element.prototype.scrollIntoView = () => {}

// ponytail: jsdom 的 localStorage 不完整(.clear 缺失/不持久化),换内存实现
const _ls: Record<string, string> = {}
const _lsImpl = {
  getItem: (k: string) => (k in _ls ? _ls[k] : null),
  setItem: (k: string, v: string) => { _ls[k] = String(v) },
  removeItem: (k: string) => { delete _ls[k] },
  clear: () => { Object.keys(_ls).forEach(k => delete _ls[k]) },
  key: (i: number) => Object.keys(_ls)[i] ?? null,
  get length() { return Object.keys(_ls).length },
}
try { Object.defineProperty(globalThis, 'localStorage', { value: _lsImpl, configurable: true, writable: true }) } catch { /* ignore */ }

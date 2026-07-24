import '@testing-library/jest-dom'

// ponytail: minimal ResizeObserver polyfill for tests (Gantt.tsx uses it)
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

// ponytail: Radix UI (Select 等)依赖 Pointer Events API,jsdom 未实现 → 测试里补桩
globalThis.Element.prototype.hasPointerCapture = () => false
globalThis.Element.prototype.setPointerCapture = () => {}
globalThis.Element.prototype.releasePointerCapture = () => {}
globalThis.Element.prototype.scrollIntoView = () => {}

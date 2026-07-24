import '@testing-library/jest-dom'

// ponytail: minimal ResizeObserver polyfill for tests (Gantt.tsx uses it)
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

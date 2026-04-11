import { vi } from 'vitest'

// Mock IntersectionObserver for jsdom environment (it's not available in jsdom)
class IntersectionObserverMock {
  observe    = vi.fn()
  unobserve  = vi.fn()
  disconnect = vi.fn()
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable:     true,
  configurable: true,
  value:        IntersectionObserverMock,
})

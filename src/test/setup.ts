import '@testing-library/jest-dom/vitest'

// jsdom does not implement the browser observer used by storefront scroll
// reveals. This keeps component tests focused on rendering behavior.
class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: readonly number[] = []
  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
  unobserve(): void {}
}

globalThis.IntersectionObserver = TestIntersectionObserver

/**
 * Global Test Setup for agate-admin
 *
 * Configures Vitest with:
 * - Global cleanup hook integration
 * - MSW for API mocking
 * - Test environment variables
 */

import { afterEach, afterAll, beforeAll, vi } from 'vitest'
import { cleanupTestData } from './helpers/cleanup'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

// Setup MSW server for API mocking
const mswServer = setupServer(...handlers)

// Log test environment
console.log('[Frontend Tests] Test environment:', process.env.NODE_ENV || 'development')
console.log('[Frontend Tests] Cleanup enabled:', process.env.TEST_CLEANUP === 'true')
console.log('[Frontend Tests] MSW server enabled')

// Start MSW server before all tests
beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: 'warn' })
})

// Reset handlers after each test
afterEach(() => {
  mswServer.resetHandlers()
})

// Close MSW server after all tests
afterAll(() => {
  mswServer.close()
})

// Global cleanup after all tests
afterAll(async () => {
  await cleanupTestData()
})

// Optional: Cleanup after each test suite (for better isolation)
// Uncomment if you need more frequent cleanup
// afterEach(async () => {
//   await cleanupTestData()
// })

// Mock window.matchMedia for components that use responsive design
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock window.location for navigation tests
const originalLocation = window.location
Object.defineProperty(window, 'location', {
  writable: true,
  value: {
    ...originalLocation,
    assign: vi.fn(),
    reload: vi.fn(),
    replace: vi.fn(),
  },
})

export {}

/**
 * Cleanup Helper for agate-admin
 *
 * Integrates with backend /admin/test/cleanup endpoint
 */

const ENABLE_CLEANUP = process.env.TEST_CLEANUP === 'true'
const ADMIN_BASE_URL = process.env.TEST_ADMIN_BASE_URL || 'http://localhost:8788'
const ADMIN_API_KEY = process.env.TEST_ADMIN_API_KEY || 'sk-admin_dev_fixed_key_local_2024'

export interface CleanupResult {
  success: boolean
  message: string
  tables: string[]
  deletedRows: number
}

let cleanupCompleted = false

/**
 * Call the backend cleanup endpoint
 */
export async function cleanupTestData(): Promise<CleanupResult | null> {
  if (!ENABLE_CLEANUP || cleanupCompleted) {
    return null
  }

  try {
    console.log('[Frontend Tests] Running test data cleanup...')
    const response = await fetch(`${ADMIN_BASE_URL}/admin/test/cleanup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ADMIN_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.warn('[Frontend Tests] Cleanup request failed:', response.status, response.statusText)
      return null
    }

    const result = await response.json() as CleanupResult
    console.log(`[Frontend Tests] Cleanup completed: ${result.deletedRows} rows deleted from ${result.tables.length} tables`)
    cleanupCompleted = true
    return result
  } catch (error) {
    console.warn('[Frontend Tests] Cleanup skipped:', error)
    return null
  }
}

/**
 * Reset cleanup state (for testing purposes)
 */
export function resetCleanupState(): void {
  cleanupCompleted = false
}

/**
 * Check if cleanup is enabled
 */
export function isCleanupEnabled(): boolean {
  return ENABLE_CLEANUP
}

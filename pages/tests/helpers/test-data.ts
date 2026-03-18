/**
 * Test Data Factory for agate-admin
 *
 * Generates test data that follows the cleanup rules:
 * - IDs ending with 13+ digits (timestamps)
 * - Emails containing @example.com
 * - Names starting with "Test " or containing timestamp patterns
 */

let testCounter = 0

/**
 * Generate unique ID with timestamp
 * Pattern: {prefix}_{timestamp}_{counter}
 */
export function generateUniqueId(prefix: string): string {
  const timestamp = Date.now()
  const counter = ++testCounter
  return `${prefix}_${timestamp}_${counter}`
}

/**
 * Generate unique test email (matches @example.com cleanup pattern)
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

/**
 * Generate test company data
 */
export interface TestCompanyData {
  id: string
  name: string
  quota_pool: number
  quota_daily: number
}

export function createTestCompanyData(overrides?: Partial<TestCompanyData>): TestCompanyData {
  return {
    id: generateUniqueId('company'),
    name: generateUniqueId('Test Company'),
    quota_pool: 1000000,
    quota_daily: 10000,
    ...overrides,
  }
}

/**
 * Generate test department data
 */
export interface TestDepartmentData {
  id: string
  company_id: string
  name: string
  quota_pool: number
  quota_daily: number
}

export function createTestDepartmentData(
  companyId: string,
  overrides?: Partial<TestDepartmentData>
): TestDepartmentData {
  return {
    id: generateUniqueId('dept'),
    company_id: companyId,
    name: generateUniqueId('Test Department'),
    quota_pool: 500000,
    quota_daily: 5000,
    ...overrides,
  }
}

/**
 * Generate test user data
 */
export interface TestUserData {
  email: string
  name: string
  company_id: string
  department_id?: string
  role: 'admin' | 'user'
  quota_daily: number
}

export function createTestUserData(
  companyId: string,
  departmentId: string | null = null,
  overrides?: Partial<TestUserData>
): TestUserData {
  return {
    email: generateTestEmail(),
    name: `Test User ${Date.now()}`,
    company_id: companyId,
    ...(departmentId ? { department_id: departmentId } : {}),
    role: 'user',
    quota_daily: 1000,
    ...overrides,
  }
}

/**
 * Generate test API key data
 */
export interface TestApiKeyData {
  user_id: string
  name: string
  quota_daily: number
}

export function createTestApiKeyData(
  userId: string,
  overrides?: Partial<TestApiKeyData>
): TestApiKeyData {
  return {
    user_id: userId,
    name: generateUniqueId('Test API Key'),
    quota_daily: 1000,
    ...overrides,
  }
}

/**
 * Generate test provider data
 */
export interface TestProviderData {
  name: string
  display_name: string
  base_url: string
  api_version: string
}

export function createTestProviderData(overrides?: Partial<TestProviderData>): TestProviderData {
  return {
    name: generateUniqueId('test-provider'),
    display_name: `Test Provider ${Date.now()}`,
    base_url: 'https://api.test.com',
    api_version: '2023-06-01',
    ...overrides,
  }
}

/**
 * Generate test model data
 */
export interface TestModelData {
  model_id: string
  display_name: string
  context_window: number
  max_tokens: number
}

export function createTestModelData(overrides?: Partial<TestModelData>): TestModelData {
  return {
    model_id: generateUniqueId('test-model'),
    display_name: `Test Model ${Date.now()}`,
    context_window: 200000,
    max_tokens: 4096,
    ...overrides,
  }
}

/**
 * Reset test counter for test isolation
 */
export function resetTestCounter(): void {
  testCounter = 0
}

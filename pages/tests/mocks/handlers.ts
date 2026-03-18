/**
 * MSW (Mock Service Worker) API Handlers
 *
 * Mock API responses for testing without backend server
 */

import { http, HttpResponse } from 'msw'

// Base URLs
const ADMIN_BASE_URL = process.env.TEST_ADMIN_BASE_URL || 'http://localhost:8788'
const PROXY_BASE_URL = process.env.TEST_PROXY_BASE_URL || 'http://localhost:8787'

// Mock admin API key
const TEST_ADMIN_API_KEY = 'sk-admin_dev_fixed_key_local_2024'

// Test data
const testCompanies = [
  {
    id: 'company_test_1704067200000_1',
    name: 'Test Company 1704067200000_1',
    quota_pool: 1000000,
    quota_daily: 10000,
    created_at: Date.now(),
  },
]

const testDepartments = [
  {
    id: 'dept_test_1704067200000_1',
    company_id: testCompanies[0].id,
    name: 'Test Department 1704067200000_1',
    quota_pool: 500000,
    quota_daily: 5000,
    created_at: Date.now(),
  },
]

const testUsers = [
  {
    id: 'user_test_1704067200000_1',
    email: 'test-1704067200000-abc123@example.com',
    name: 'Test User 1704067200000',
    role: 'admin',
    company_id: testCompanies[0].id,
    company_name: testCompanies[0].name,
    department_id: null,
    department_name: null,
    quota_daily: 100000,
    quota_used: 0,
    is_active: true,
    is_system: false,
    api_key_count: 0,
    created_at: Date.now(),
  },
]

const testProviders = [
  {
    id: 'provider_test_1704067200000_1',
    name: 'test-provider-1704067200000_1',
    display_name: 'Test Provider 1704067200000',
    base_url: 'https://api.test.com',
    api_version: '2023-06-01',
    created_at: Date.now(),
  },
]

const testModels = [
  {
    id: 'model_test_1704067200000_1',
    model_id: 'test-model-1704067200000_1',
    display_name: 'Test Model 1704067200000',
    context_window: 200000,
    max_tokens: 4096,
    created_at: Date.now(),
  },
]

const testApiKeys = [
  {
    id: 'key_test_1704067200000_1',
    user_id: testUsers[0].id,
    name: 'Test API Key 1704067200000_1',
    key_preview: 'sk_test_...1234',
    quota_daily: 1000,
    quota_used: 100,
    quota_bonus: 0,
    is_active: true,
    created_at: Date.now(),
    expires_at: null,
  },
]

// Auth handlers
export const authHandlers = [
  // Admin auth - success
  http.get(`${ADMIN_BASE_URL}/admin/auth`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (authHeader === `Bearer ${TEST_ADMIN_API_KEY}`) {
      return HttpResponse.json({
        userId: 'admin_test_user',
        userEmail: 'admin@test.com',
        userName: 'Test Admin',
        userRole: 'admin',
        companyId: testCompanies[0].id,
        companyName: testCompanies[0].name,
        departmentId: null,
        departmentName: null,
      })
    }
    return new HttpResponse(null, { status: 401 })
  }),

  // User auth (for non-admin users)
  http.get(`${ADMIN_BASE_URL}/user/auth`, () => {
    return HttpResponse.json({
      userId: 'user_test_user',
      userEmail: 'user@test.com',
      userName: 'Test User',
      userRole: 'user',
      companyId: testCompanies[0].id,
      companyName: testCompanies[0].name,
      departmentId: testDepartments[0].id,
      departmentName: testDepartments[0].name,
    })
  }),
]

// Users handlers
export const userHandlers = [
  // Get users list
  http.get(`${ADMIN_BASE_URL}/admin/users`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('page_size') || '20')

    return HttpResponse.json({
      total: testUsers.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(testUsers.length / pageSize),
      users: testUsers,
    })
  }),

  // Create user
  http.post(`${ADMIN_BASE_URL}/admin/users`, async ({ request }) => {
    const data = await request.json()
    const newUser = {
      id: `user_test_${Date.now()}_1`,
      ...data,
      quota_used: 0,
      is_active: true,
      is_system: false,
      api_key_count: 0,
      created_at: Date.now(),
    }
    testUsers.push(newUser)
    return HttpResponse.json(newUser)
  }),

  // Update user
  http.put(`${ADMIN_BASE_URL}/admin/users/:id`, async ({ params, request }) => {
    const data = await request.json()
    const userIndex = testUsers.findIndex((u) => u.id === params.id)
    if (userIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testUsers[userIndex] = { ...testUsers[userIndex], ...data }
    return HttpResponse.json(testUsers[userIndex])
  }),

  // Delete user
  http.delete(`${ADMIN_BASE_URL}/admin/users/:id`, ({ params }) => {
    const userIndex = testUsers.findIndex((u) => u.id === params.id)
    if (userIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testUsers.splice(userIndex, 1)
    return HttpResponse.json({ success: true })
  }),
]

// Companies handlers
export const companyHandlers = [
  // Get companies list
  http.get(`${ADMIN_BASE_URL}/admin/companies`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('page_size') || '20')

    return HttpResponse.json({
      total: testCompanies.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(testCompanies.length / pageSize),
      companies: testCompanies,
    })
  }),

  // Create company
  http.post(`${ADMIN_BASE_URL}/admin/companies`, async ({ request }) => {
    const data = await request.json()
    const newCompany = {
      id: `company_test_${Date.now()}_1`,
      ...data,
      created_at: Date.now(),
    }
    testCompanies.push(newCompany)
    return HttpResponse.json(newCompany)
  }),

  // Update company
  http.put(`${ADMIN_BASE_URL}/admin/companies/:id`, async ({ params, request }) => {
    const data = await request.json()
    const companyIndex = testCompanies.findIndex((c) => c.id === params.id)
    if (companyIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testCompanies[companyIndex] = { ...testCompanies[companyIndex], ...data }
    return HttpResponse.json(testCompanies[companyIndex])
  }),

  // Delete company
  http.delete(`${ADMIN_BASE_URL}/admin/companies/:id`, ({ params }) => {
    const companyIndex = testCompanies.findIndex((c) => c.id === params.id)
    if (companyIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testCompanies.splice(companyIndex, 1)
    return HttpResponse.json({ success: true })
  }),
]

// Departments handlers
export const departmentHandlers = [
  // Get departments list
  http.get(`${ADMIN_BASE_URL}/admin/departments`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('page_size') || '20')
    const companyId = url.searchParams.get('company_id')

    let filtered = testDepartments
    if (companyId) {
      filtered = testDepartments.filter((d) => d.company_id === companyId)
    }

    return HttpResponse.json({
      total: filtered.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(filtered.length / pageSize),
      departments: filtered,
    })
  }),

  // Create department
  http.post(`${ADMIN_BASE_URL}/admin/departments`, async ({ request }) => {
    const data = await request.json()
    const newDepartment = {
      id: `dept_test_${Date.now()}_1`,
      ...data,
      created_at: Date.now(),
    }
    testDepartments.push(newDepartment)
    return HttpResponse.json(newDepartment)
  }),

  // Update department
  http.put(`${ADMIN_BASE_URL}/admin/departments/:id`, async ({ params, request }) => {
    const data = await request.json()
    const deptIndex = testDepartments.findIndex((d) => d.id === params.id)
    if (deptIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testDepartments[deptIndex] = { ...testDepartments[deptIndex], ...data }
    return HttpResponse.json(testDepartments[deptIndex])
  }),

  // Delete department
  http.delete(`${ADMIN_BASE_URL}/admin/departments/:id`, ({ params }) => {
    const deptIndex = testDepartments.findIndex((d) => d.id === params.id)
    if (deptIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testDepartments.splice(deptIndex, 1)
    return HttpResponse.json({ success: true })
  }),
]

// API Keys handlers
export const apiKeyHandlers = [
  // Get keys list
  http.get(`${ADMIN_BASE_URL}/admin/keys`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('page_size') || '20')

    return HttpResponse.json({
      total: testApiKeys.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(testApiKeys.length / pageSize),
      keys: testApiKeys,
    })
  }),

  // Create API key
  http.post(`${ADMIN_BASE_URL}/admin/keys`, async ({ request }) => {
    const data = await request.json()
    const newKey = {
      id: `key_test_${Date.now()}_1`,
      ...data,
      key_preview: `sk_test_...${Math.random().toString(36).slice(2, 6)}`,
      quota_used: 0,
      quota_bonus: 0,
      is_active: true,
      created_at: Date.now(),
      expires_at: null,
    }
    testApiKeys.push(newKey)
    return HttpResponse.json(newKey)
  }),

  // Update API key
  http.put(`${ADMIN_BASE_URL}/admin/keys/:id`, async ({ params, request }) => {
    const data = await request.json()
    const keyIndex = testApiKeys.findIndex((k) => k.id === params.id)
    if (keyIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testApiKeys[keyIndex] = { ...testApiKeys[keyIndex], ...data }
    return HttpResponse.json(testApiKeys[keyIndex])
  }),

  // Disable API key
  http.post(`${ADMIN_BASE_URL}/admin/keys/:id/disable`, ({ params }) => {
    const keyIndex = testApiKeys.findIndex((k) => k.id === params.id)
    if (keyIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testApiKeys[keyIndex].is_active = false
    return HttpResponse.json({ success: true })
  }),

  // Enable API key
  http.post(`${ADMIN_BASE_URL}/admin/keys/:id/enable`, ({ params }) => {
    const keyIndex = testApiKeys.findIndex((k) => k.id === params.id)
    if (keyIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testApiKeys[keyIndex].is_active = true
    return HttpResponse.json({ success: true })
  }),

  // Add bonus quota
  http.post(`${ADMIN_BASE_URL}/admin/keys/:id/bonus`, async ({ params, request }) => {
    const data = await request.json()
    const keyIndex = testApiKeys.findIndex((k) => k.id === params.id)
    if (keyIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testApiKeys[keyIndex].quota_bonus += data.amount || 0
    return HttpResponse.json(testApiKeys[keyIndex])
  }),
]

// Providers handlers
export const providerHandlers = [
  // Get providers list
  http.get(`${ADMIN_BASE_URL}/admin/providers`, () => {
    return HttpResponse.json({
      total: testProviders.length,
      providers: testProviders,
    })
  }),

  // Create provider
  http.post(`${ADMIN_BASE_URL}/admin/providers`, async ({ request }) => {
    const data = await request.json()
    const newProvider = {
      id: `provider_test_${Date.now()}_1`,
      ...data,
      created_at: Date.now(),
    }
    testProviders.push(newProvider)
    return HttpResponse.json(newProvider)
  }),

  // Update provider
  http.put(`${ADMIN_BASE_URL}/admin/providers/:id`, async ({ params, request }) => {
    const data = await request.json()
    const providerIndex = testProviders.findIndex((p) => p.id === params.id)
    if (providerIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testProviders[providerIndex] = { ...testProviders[providerIndex], ...data }
    return HttpResponse.json(testProviders[providerIndex])
  }),

  // Delete provider
  http.delete(`${ADMIN_BASE_URL}/admin/providers/:id`, ({ params }) => {
    const providerIndex = testProviders.findIndex((p) => p.id === params.id)
    if (providerIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testProviders.splice(providerIndex, 1)
    return HttpResponse.json({ success: true })
  }),

  // Get provider credentials
  http.get(`${ADMIN_BASE_URL}/admin/providers/:providerId/credentials`, () => {
    return HttpResponse.json({
      credentials: [],
    })
  }),

  // Add credential
  http.post(`${ADMIN_BASE_URL}/admin/providers/:providerId/credentials`, async ({ request }) => {
    const data = await request.json()
    return HttpResponse.json({
      id: `cred_test_${Date.now()}_1`,
      ...data,
      created_at: Date.now(),
    })
  }),

  // Delete credential
  http.delete(`${ADMIN_BASE_URL}/admin/providers/:providerId/credentials/:credentialId`, () => {
    return HttpResponse.json({ success: true })
  }),
]

// Models handlers
export const modelHandlers = [
  // Get models list
  http.get(`${ADMIN_BASE_URL}/admin/models`, () => {
    return HttpResponse.json({
      total: testModels.length,
      models: testModels,
    })
  }),

  // Create model
  http.post(`${ADMIN_BASE_URL}/admin/models`, async ({ request }) => {
    const data = await request.json()
    const newModel = {
      id: `model_test_${Date.now()}_1`,
      ...data,
      created_at: Date.now(),
    }
    testModels.push(newModel)
    return HttpResponse.json(newModel)
  }),

  // Update model
  http.put(`${ADMIN_BASE_URL}/admin/models/:id`, async ({ params, request }) => {
    const data = await request.json()
    const modelIndex = testModels.findIndex((m) => m.id === params.id)
    if (modelIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testModels[modelIndex] = { ...testModels[modelIndex], ...data }
    return HttpResponse.json(testModels[modelIndex])
  }),

  // Delete model
  http.delete(`${ADMIN_BASE_URL}/admin/models/:id`, ({ params }) => {
    const modelIndex = testModels.findIndex((m) => m.id === params.id)
    if (modelIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    testModels.splice(modelIndex, 1)
    return HttpResponse.json({ success: true })
  }),

  // Add model provider
  http.post(`${ADMIN_BASE_URL}/admin/models/:modelId/providers`, async ({ request }) => {
    const data = await request.json()
    return HttpResponse.json({
      id: `mp_test_${Date.now()}_1`,
      ...data,
      created_at: Date.now(),
    })
  }),

  // Remove model provider
  http.delete(`${ADMIN_BASE_URL}/admin/models/:modelId/providers/:providerId`, () => {
    return HttpResponse.json({ success: true })
  }),
]

// Test cleanup handler
export const cleanupHandlers = [
  http.post(`${ADMIN_BASE_URL}/admin/test/cleanup`, () => {
    return HttpResponse.json({
      success: true,
      message: 'Test data cleanup completed',
      tables: ['users', 'companies', 'departments', 'api_keys', 'providers', 'models'],
      deletedRows: 0,
    })
  }),
]

// Statistics handlers
export const statsHandlers = [
  // Usage stats
  http.get(`${ADMIN_BASE_URL}/admin/stats/usage`, () => {
    return HttpResponse.json({
      groups: [],
      total_tokens: 0,
      total_cost: 0,
    })
  }),

  // Token usage
  http.get(`${ADMIN_BASE_URL}/admin/stats/tokens`, () => {
    return HttpResponse.json({
      hourly: [],
      daily: [],
      weekly: [],
      monthly: [],
    })
  }),

  // Cost analysis
  http.get(`${ADMIN_BASE_URL}/admin/stats/costs`, () => {
    return HttpResponse.json({
      by_model: [],
      by_provider: [],
      total_cost: 0,
    })
  }),

  // Model stats
  http.get(`${ADMIN_BASE_URL}/admin/stats/models`, () => {
    return HttpResponse.json({
      stats: [],
    })
  }),

  // Logs
  http.get(`${ADMIN_BASE_URL}/admin/logs`, () => {
    return HttpResponse.json({
      logs: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
    })
  }),

  // Quotas
  http.get(`${ADMIN_BASE_URL}/admin/quotas`, () => {
    return HttpResponse.json({
      quotas: [],
    })
  }),
]

// Combine all handlers
export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...companyHandlers,
  ...departmentHandlers,
  ...apiKeyHandlers,
  ...providerHandlers,
  ...modelHandlers,
  ...cleanupHandlers,
  ...statsHandlers,
]

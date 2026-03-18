/**
 * API Keys Management Integration Tests
 *
 * Tests for the API keys management view component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KeysView from '@/views/admin/keys/index.vue'
import * as adminApi from '@/shared/api/admin'

// Mock Naive UI composables and components
vi.mock('naive-ui', () => ({
  useMessage: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
  useDialog: () => ({
    create: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
  // Component mocks
  NCard: { template: '<div class="n-card"><slot /><slot name="header-extra" /></div>', props: ['title'] },
  NSpace: { template: '<div class="n-space"><slot /></div>' },
  NButton: { template: '<button class="n-button"><slot /></button>' },
  NInput: { template: '<input class="n-input" />', props: ['value', 'placeholder', 'clearable'] },
  NSelect: { template: '<select class="n-select"><slot /></select>', props: ['value', 'options', 'placeholder'] },
  NDataTable: { template: '<table class="n-data-table"><slot /></table>' },
  NModal: { template: '<div v-if="show" class="n-modal"><slot /></div>', props: ['show'] },
  NForm: { template: '<form class="n-form"><slot /></form>' },
  NFormItem: { template: '<div class="n-form-item"><label><slot name="label" /></label><slot /></div>' },
  NInputNumber: { template: '<input type="number" class="n-input-number" />', props: ['value', 'min'] },
  NPopconfirm: { template: '<div class="n-popconfirm"><slot name="trigger" /><slot /></div>' },
  NTag: { template: '<span class="n-tag"><slot /></span>', props: ['type'] },
  NSwitch: { template: '<input type="checkbox" class="n-switch" />', props: ['value'] },
  NPagination: { template: '<div class="n-pagination"></div>', props: ['page', 'pageCount', 'onUpdate:page'] },
}))

// Mock admin API
vi.mock('@/shared/api/admin', () => ({
  getKeys: vi.fn(),
  createKey: vi.fn(),
  updateKey: vi.fn(),
  disableKey: vi.fn(),
  enableKey: vi.fn(),
  addBonusQuota: vi.fn(),
  getUsers: vi.fn(),
  getCompanies: vi.fn(),
  getDepartments: vi.fn(),
}))

describe('KeysView', () => {
  let wrapper: VueWrapper<any>
  let pinia: ReturnType<typeof createPinia>

  const mockKeys = [
    {
      id: 'key_test_1704067200000_1',
      user_id: 'user_test_1704067200000_1',
      user_name: 'Test User',
      company_name: 'Test Company',
      department_name: 'Test Department',
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

  const mockUsers = [
    {
      id: 'user_test_1704067200000_1',
      email: 'test-user@example.com',
      name: 'Test User',
      company_id: 'company_test_1704067200000_1',
      company_name: 'Test Company',
    },
  ]

  const mockCompanies = [
    {
      id: 'company_test_1704067200000_1',
      name: 'Test Company 1704067200000_1',
    },
  ]

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock API responses
    vi.mocked(adminApi.getKeys).mockResolvedValue({
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      keys: mockKeys,
    })

    vi.mocked(adminApi.getUsers).mockResolvedValue({
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      users: mockUsers,
    })

    vi.mocked(adminApi.getCompanies).mockResolvedValue({
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      companies: mockCompanies,
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(KeysView, {
      global: {
        plugins: [pinia],
      },
    })
  }

  describe('rendering', () => {
    it('should render API keys list correctly', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(adminApi.getKeys).toHaveBeenCalledWith({
        page: 1,
        page_size: 20,
      })
    })

    it('should load API keys on mount', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.vm.keys).toEqual(mockKeys)
    })

    it('should load users for dropdown', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(adminApi.getUsers).toHaveBeenCalled()
    })
  })

  describe('create API key', () => {
    it('should show create modal when setting showCreateModal to true', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.showCreateModal).toBe(false)

      wrapper.vm.showCreateModal = true
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.showCreateModal).toBe(true)
    })
  })

  describe('toggle key status', () => {
    it('should disable active key successfully', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      vi.mocked(adminApi.disableKey).mockResolvedValue({
        success: true,
      })

      await wrapper.vm.handleDisable(mockKeys[0])

      expect(adminApi.disableKey).toHaveBeenCalledWith(mockKeys[0].id)
    })

    it('should enable disabled key successfully', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      const disabledKey = { ...mockKeys[0], is_active: false }

      vi.mocked(adminApi.enableKey).mockResolvedValue({
        success: true,
      })

      await wrapper.vm.handleDisable(disabledKey)

      expect(adminApi.enableKey).toHaveBeenCalledWith(disabledKey.id)
    })
  })

  describe('pagination', () => {
    it('should have pagination configured correctly', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.pagination).toBeDefined()
      expect(wrapper.vm.pagination.page).toBe(1)
      expect(wrapper.vm.pagination.pageSize).toBe(20)
    })
  })
})

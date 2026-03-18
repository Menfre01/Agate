/**
 * Providers Management Integration Tests
 *
 * Tests for the providers management view component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProvidersView from '@/views/admin/providers/index.vue'
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
  NDataTable: { template: '<table class="n-data-table"><slot /></table>' },
  NModal: { template: '<div v-if="show" class="n-modal"><slot /></div>', props: ['show'] },
  NForm: { template: '<form class="n-form"><slot /></form>' },
  NFormItem: { template: '<div class="n-form-item"><label><slot name="label" /></label><slot /></div>' },
  NInputNumber: { template: '<input type="number" class="n-input-number" />', props: ['value', 'min'] },
  NPopconfirm: { template: '<div class="n-popconfirm"><slot name="trigger" /><slot /></div>' },
  NTabs: { template: '<div class="n-tabs"><slot /></div>' },
  NTabPane: { template: '<div class="n-tab-pane"><slot /></div>' },
  NCollapse: { template: '<div class="n-collapse"><slot /></div>' },
  NCollapseItem: { template: '<div class="n-collapse-item"><slot name="header" /><slot /></div>' },
}))

// Mock admin API
vi.mock('@/shared/api/admin', () => ({
  getProviders: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  deleteProvider: vi.fn(),
  getProviderCredentials: vi.fn(),
  addCredential: vi.fn(),
  deleteCredential: vi.fn(),
}))

describe('ProvidersView', () => {
  let wrapper: VueWrapper<any>
  let pinia: ReturnType<typeof createPinia>

  const mockProviders = [
    {
      id: 'provider_test_1704067200000_1',
      name: 'test-provider-1704067200000_1',
      display_name: 'Test Provider 1704067200000',
      base_url: 'https://api.test.com',
      api_version: '2023-06-01',
      created_at: Date.now(),
    },
  ]

  const mockCredentials = [
    {
      id: 'cred_test_1704067200000_1',
      credential_name: 'Test Credential 1704067200000_1',
      api_key: 'sk-test-1234',
      priority: 0,
      weight: 1,
      is_active: true,
      created_at: Date.now(),
    },
  ]

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock API responses
    vi.mocked(adminApi.getProviders).mockResolvedValue({
      total: 1,
      providers: mockProviders,
    })

    vi.mocked(adminApi.getProviderCredentials).mockResolvedValue({
      credentials: mockCredentials,
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(ProvidersView, {
      global: {
        plugins: [pinia],
      },
    })
  }

  describe('rendering', () => {
    it('should render providers list correctly', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(adminApi.getProviders).toHaveBeenCalled()
    })

    it('should load providers on mount', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.vm.providers).toEqual(mockProviders)
    })
  })

  describe('create provider', () => {
    it('should have openCreateModal method', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      expect(typeof wrapper.vm.openCreateModal).toBe('function')
    })

    it('should have closeModal method', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      expect(typeof wrapper.vm.closeModal).toBe('function')
    })
  })

  describe('credentials management', () => {
    it('should load credentials for a provider', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      await wrapper.vm.loadCredentials(mockProviders[0].id)

      expect(adminApi.getProviderCredentials).toHaveBeenCalledWith(mockProviders[0].id)
    })
  })
})

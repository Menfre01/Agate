/**
 * Models Management Integration Tests
 *
 * Tests for the models management view component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ModelsView from '@/views/admin/models/index.vue'
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
  NTag: { template: '<span class="n-tag"><slot /></span>', props: ['type'] },
  NList: { template: '<ul class="n-list"><slot /></ul>' },
  NListItem: { template: '<li class="n-list-item"><slot /></li>' },
}))

// Mock admin API
vi.mock('@/shared/api/admin', () => ({
  getModels: vi.fn(),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  deleteModel: vi.fn(),
  getProviders: vi.fn(),
  addModelProvider: vi.fn(),
  removeModelProvider: vi.fn(),
}))

describe('ModelsView', () => {
  let wrapper: VueWrapper<any>
  let pinia: ReturnType<typeof createPinia>

  const mockModels = [
    {
      id: 'model_test_1704067200000_1',
      model_id: 'test-model-1704067200000_1',
      display_name: 'Test Model 1704067200000',
      context_window: 200000,
      max_tokens: 4096,
      created_at: Date.now(),
      providers: [
        {
          id: 'mp_test_1704067200000_1',
          provider_id: 'provider_test_1704067200000_1',
          provider_name: 'Test Provider',
          input_price: 0.003,
          output_price: 0.015,
        },
      ],
    },
  ]

  const mockProviders = [
    {
      id: 'provider_test_1704067200000_1',
      name: 'test-provider-1704067200000_1',
      display_name: 'Test Provider 1704067200000',
    },
  ]

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock API responses
    vi.mocked(adminApi.getModels).mockResolvedValue({
      total: 1,
      models: mockModels,
    })

    vi.mocked(adminApi.getProviders).mockResolvedValue({
      total: 1,
      providers: mockProviders,
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(ModelsView, {
      global: {
        plugins: [pinia],
      },
    })
  }

  describe('rendering', () => {
    it('should mount without errors', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(wrapper.exists()).toBe(true)
    })

    it('should call getModels on mount', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(adminApi.getModels).toHaveBeenCalled()
    })

    it('should call getProviders on mount', async () => {
      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(adminApi.getProviders).toHaveBeenCalled()
    })
  })
})

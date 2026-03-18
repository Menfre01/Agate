/**
 * Company Management Integration Tests
 *
 * Tests for the company management view component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CompaniesView from '@/views/admin/companies/index.vue'
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
  NInputNumber: { template: '<input type="number" class="n-input-number" />', props: ['value', 'min'] },
  NDataTable: { template: '<table class="n-data-table"><slot /></table>' },
  NModal: { template: '<div v-if="show" class="n-modal"><slot /></div>', props: ['show'] },
  NForm: { template: '<form class="n-form"><slot /></form>' },
  NFormItem: { template: '<div class="n-form-item"><label><slot name="label" /></label><slot /></div>' },
  NPopconfirm: { template: '<div class="n-popconfirm"><slot name="trigger" /><slot /></div>' },
  NPagination: { template: '<div class="n-pagination"></div>', props: ['page', 'pageCount', 'onUpdate:page'] },
  NTag: { template: '<span class="n-tag"><slot /></span>', props: ['type'] },
}))

// Mock admin API
vi.mock('@/shared/api/admin', () => ({
  getCompanies: vi.fn(),
  createCompany: vi.fn(),
  updateCompany: vi.fn(),
  deleteCompany: vi.fn(),
}))

describe('CompaniesView', () => {
  let wrapper: VueWrapper<any>
  let pinia: ReturnType<typeof createPinia>

  const mockCompanies = [
    {
      id: 'company_test_1704067200000_1',
      name: 'Test Company 1704067200000_1',
      quota_pool: 1000000,
      quota_daily: 10000,
      created_at: Date.now(),
    },
  ]

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock API responses
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

  it('should call getCompanies on mount', async () => {
    wrapper = mount(CompaniesView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(adminApi.getCompanies).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
    })
  })

  it('should load companies on mount', async () => {
    wrapper = mount(CompaniesView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(wrapper.vm.companies).toEqual(mockCompanies)
  })
})

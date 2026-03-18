/**
 * Department Management Integration Tests
 *
 * Tests for the department management view component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DepartmentsView from '@/views/admin/departments/index.vue'
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
  NSelect: { template: '<select class="n-select"><slot /></select>', props: ['value', 'options', 'placeholder'] },
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
  getDepartments: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
  getCompanies: vi.fn(),
}))

describe('DepartmentsView', () => {
  let wrapper: VueWrapper<any>
  let pinia: ReturnType<typeof createPinia>

  const mockDepartments = [
    {
      id: 'dept_test_1704067200000_1',
      company_id: 'company_test_1704067200000_1',
      name: 'Test Department 1704067200000_1',
      quota_pool: 500000,
      quota_daily: 5000,
      quota_used: 100,
      created_at: Date.now(),
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

    vi.mocked(adminApi.getDepartments).mockResolvedValue({
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      departments: mockDepartments,
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

  it('should call getDepartments and getCompanies on mount', async () => {
    wrapper = mount(DepartmentsView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(adminApi.getDepartments).toHaveBeenCalled()
    expect(adminApi.getCompanies).toHaveBeenCalled()
  })

  it('should load departments on mount', async () => {
    wrapper = mount(DepartmentsView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(wrapper.vm.departments).toEqual(mockDepartments)
  })

  it('should have pagination configured correctly', async () => {
    wrapper = mount(DepartmentsView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.vm.pagination).toBeDefined()
    expect(wrapper.vm.pagination.page).toBe(1)
    expect(wrapper.vm.pagination.pageSize).toBe(20)
  })
})

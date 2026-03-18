/**
 * User Management Integration Tests
 *
 * Tests for the user management view component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UsersView from '@/views/admin/users/index.vue'
import * as adminApi from '@/shared/api/admin'

// Mock Naive UI composables and components
vi.mock('naive-ui', () => ({
  useMessage: () => ({
    create: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
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
  NFormItem: { template: '<div class="n-form-item"><slot /><slot name="label" /></div>' },
  NInputNumber: { template: '<input type="number" class="n-input-number" />', props: ['value', 'min'] },
  NRadioGroup: { template: '<div class="n-radio-group"><slot /></div>', props: ['value'] },
  NRadio: { template: '<label class="n-radio"><slot /></label>', props: ['value'] },
  NTag: { template: '<span class="n-tag"><slot /></span>', props: ['type'] },
  NSwitch: { template: '<input type="checkbox" class="n-switch" />', props: ['value'] },
  NPopconfirm: { template: '<div class="n-popconfirm"><slot name="trigger" /><slot /></div>' },
  NPagination: { template: '<div class="n-pagination"></div>', props: ['page', 'pageCount', 'onUpdate:page'] },
}))

// Mock admin API
vi.mock('@/shared/api/admin', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getCompanies: vi.fn(),
  getDepartments: vi.fn(),
}))

describe('UsersView', () => {
  let wrapper: VueWrapper<any>
  let pinia: ReturnType<typeof createPinia>

  const mockUsers = [
    {
      id: 'user_test_1704067200000_1',
      email: 'test-user@example.com',
      name: 'Test User 1704067200000',
      role: 'user',
      company_id: 'company_test_1704067200000_1',
      company_name: 'Test Company',
      department_id: null,
      department_name: null,
      quota_daily: 1000,
      quota_used: 100,
      is_active: true,
      is_system: false,
      api_key_count: 1,
      created_at: Date.now(),
    },
  ]

  const mockCompanies = [
    {
      id: 'company_test_1704067200000_1',
      name: 'Test Company 1704067200000_1',
      quota_pool: 1000000,
      quota_daily: 10000,
    },
  ]

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    // Mock API responses
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

    vi.mocked(adminApi.getDepartments).mockResolvedValue({
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 0,
      departments: [],
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  it('should call getUsers and getCompanies on mount', async () => {
    wrapper = mount(UsersView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(adminApi.getUsers).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
    })
    expect(adminApi.getCompanies).toHaveBeenCalledWith({
      page: 1,
      page_size: 1000,
    })
  })

  it('should load users on mount', async () => {
    wrapper = mount(UsersView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))

    expect(wrapper.vm.users).toEqual(mockUsers)
  })

  it('should show create modal when setting showCreateModal to true', async () => {
    wrapper = mount(UsersView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.vm.showCreateModal).toBe(false)

    wrapper.vm.showCreateModal = true
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.showCreateModal).toBe(true)
  })

  it('should handle page change', async () => {
    wrapper = mount(UsersView, {
      global: {
        plugins: [pinia],
      },
    })

    await wrapper.vm.$nextTick()

    wrapper.vm.handlePageChange(2)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.pagination.page).toBe(2)
  })
})

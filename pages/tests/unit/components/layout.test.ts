/**
 * Layout Component Tests
 *
 * Tests for AdminLayout and UserLayout components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import UserLayout from '@/layouts/UserLayout.vue'
import { useUserStore } from '@/stores/user'

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
  NLayout: { template: '<div class="n-layout"><slot /></div>' },
  NLayoutSider: { template: '<aside class="n-layout-sider"><slot /></aside>' },
  NLayoutContent: { template: '<main class="n-layout-content"><slot /></main>' },
  NLayoutHeader: { template: '<header class="n-layout-header"><slot /></header>' },
  NMenu: { template: '<nav class="n-menu"><slot /></nav>' },
  NButton: { template: '<button class="n-button"><slot /></button>' },
  NAvatar: { template: '<div class="n-avatar"><slot /></div>' },
  NDropdown: { template: '<div class="n-dropdown"><slot /></div>' },
  NSpace: { template: '<div class="n-space"><slot /></div>' },
  NIcon: { template: '<span class="n-icon" />', props: ['component'] },
  NTooltip: { template: '<div class="n-tooltip"><slot /><slot name="trigger" /></div>' },
  NBreadcrumb: { template: '<nav class="n-breadcrumb"><slot /></nav>' },
  NBreadcrumbItem: { template: '<span class="n-breadcrumb-item"><slot /></span>' },
  NTag: { template: '<span class="n-tag"><slot /></span>' },
}))

describe('AdminLayout Component', () => {
  let wrapper: VueWrapper<any>
  let pinia: ReturnType<typeof createPinia>
  let router: any

  const mockAdminUser = {
    userId: 'admin_test_user',
    userEmail: 'admin@test.com',
    userName: 'Test Admin',
    userRole: 'admin',
    companyId: 'company_test_1704067200000_1',
    companyName: 'Test Company',
    departmentId: null,
    departmentName: null,
  }

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory('/'),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/admin', component: AdminLayout, children: [
          { path: 'users', component: { template: '<div>Users</div>' } },
          { path: 'companies', component: { template: '<div>Companies</div>' } },
        ]},
      ],
    })

    // Set up user store with admin user
    const userStore = useUserStore()
    userStore.updateUserInfo(mockAdminUser)
  })

  const mountComponent = () => {
    return mount(AdminLayout, {
      global: {
        plugins: [pinia, router],
        stubs: {
          'router-view': { template: '<div><slot /></div>' },
        },
      },
    })
  }

  describe('rendering', () => {
    it('should mount without errors', () => {
      wrapper = mountComponent()
      expect(wrapper.exists()).toBe(true)
    })

    it('should have user store with admin info', () => {
      const userStore = useUserStore()
      expect(userStore.userName).toBe('Test Admin')
      expect(userStore.isAdmin).toBe(true)
    })
  })

  describe('user menu', () => {
    it('should have logout functionality available', () => {
      const userStore = useUserStore()
      expect(typeof userStore.logout).toBe('function')
    })
  })
})

describe('UserLayout Component', () => {
  let wrapper: VueWrapper<any>
  let pinia: ReturnType<typeof createPinia>
  let router: any

  const mockNormalUser = {
    userId: 'user_test_user',
    userEmail: 'user@test.com',
    userName: 'Test User',
    userRole: 'user',
    companyId: 'company_test_1704067200000_1',
    companyName: 'Test Company',
    departmentId: 'dept_test_1704067200000_1',
    departmentName: 'Test Department',
  }

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory('/'),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/user', component: UserLayout, children: [
          { path: 'profile', component: { template: '<div>Profile</div>' } },
          { path: 'stats', component: { template: '<div>Stats</div>' } },
        ]},
      ],
    })

    // Set up user store with normal user
    const userStore = useUserStore()
    userStore.updateUserInfo(mockNormalUser)
  })

  const mountComponent = () => {
    return mount(UserLayout, {
      global: {
        plugins: [pinia, router],
        stubs: {
          'router-view': { template: '<div><slot /></div>' },
        },
      },
    })
  }

  describe('rendering', () => {
    it('should mount without errors', () => {
      wrapper = mountComponent()
      expect(wrapper.exists()).toBe(true)
    })

    it('should have user store with user info', () => {
      const userStore = useUserStore()
      expect(userStore.userName).toBe('Test User')
      expect(userStore.isAdmin).toBe(false)
      expect(userStore.companyName).toBe('Test Company')
      expect(userStore.departmentName).toBe('Test Department')
    })
  })

  describe('user menu', () => {
    it('should have logout functionality available', () => {
      const userStore = useUserStore()
      expect(typeof userStore.logout).toBe('function')
    })
  })
})

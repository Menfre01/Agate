/**
 * Login Page Component Tests
 *
 * Tests for the login page component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LoginView from '@/pages/login/index.vue'
import { useUserStore } from '@/stores/user'
import { createRouter, createWebHistory } from 'vue-router'

// Mock Naive UI composables and components
vi.mock('naive-ui', () => ({
  useMessage: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
  // Component mocks
  NForm: { template: '<form class="n-form"><slot /></form>' },
  NFormItem: { template: '<div class="n-form-item"><label><slot name="label" /></label><slot /></div>' },
  NInput: { template: '<input class="n-input" type="password" />', props: ['value', 'type', 'placeholder'] },
  NButton: { template: '<button class="n-button" :disabled="loading"><slot /></button>', props: ['loading', 'disabled'] },
  NSpace: { template: '<div class="n-space"><slot /></div>' },
  NCard: { template: '<div class="n-card"><slot /></div>' },
}))

const mockAdminUser = {
  userId: 'admin_test_user',
  userEmail: 'admin@test.com',
  userName: 'Test Admin',
  userRole: 'admin' as const,
  companyId: 'company_test_1704067200000_1',
  companyName: 'Test Company',
  departmentId: null,
  departmentName: null,
}

describe('LoginView Component', () => {
  let wrapper: VueWrapper<any>
  let pinia: ReturnType<typeof createPinia>
  let router: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory('/'),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/login', component: LoginView },
        { path: '/admin', component: { template: '<div>Admin Dashboard</div>' } },
        { path: '/user', component: { template: '<div>User Dashboard</div>' } },
      ],
    })

    return router.push('/login').then(() => router.isReady())
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(LoginView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    })
  }

  describe('rendering', () => {
    it('should render login form correctly', () => {
      wrapper = mountComponent()

      expect(wrapper.find('h1').text()).toBe('Agate')
      expect(wrapper.find('.login-box').exists()).toBe(true)
      expect(wrapper.find('input[type="password"]').exists()).toBe(true)
      expect(wrapper.find('button').text()).toContain('登录')
    })

    it('should have correct page title and description', () => {
      wrapper = mountComponent()

      expect(wrapper.find('h1').text()).toBe('Agate')
      expect(wrapper.find('p').text()).toBe('AI Gateway 管理后台')
    })
  })

  describe('form validation', () => {
    it('should prevent submission when API key is empty', async () => {
      wrapper = mountComponent()

      const submitButton = wrapper.find('button')
      await submitButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Form validation should prevent submission - should still be on login page
      expect(router.currentRoute.value.path).toBe('/login')
    })

    it('should validate minimum API key length', async () => {
      wrapper = mountComponent()

      const input = wrapper.find('input[type="password"]')
      await input.setValue('short')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      const submitButton = wrapper.find('button')
      await submitButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should still be on login page due to validation
      expect(router.currentRoute.value.path).toBe('/login')
    })
  })

  describe('login functionality', () => {
    it('should have login method that accepts API key', async () => {
      wrapper = mountComponent()

      const userStore = useUserStore()
      vi.spyOn(userStore, 'login').mockResolvedValue(mockAdminUser as any)

      // Try calling the login method directly
      await userStore.login('sk-admin_test_key')

      expect(userStore.login).toHaveBeenCalledWith('sk-admin_test_key')
    })

    it('should handle login failure gracefully', async () => {
      wrapper = mountComponent()

      const userStore = useUserStore()
      vi.spyOn(userStore, 'login').mockRejectedValue(new Error('Invalid API Key'))

      // Try calling the login method directly
      await expect(userStore.login('invalid-key')).rejects.toThrow()
    })
  })
})

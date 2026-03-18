/**
 * User Store Tests
 *
 * Tests for Pinia user store
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from '@/stores/user'
import * as authApi from '@/shared/api/auth'

// Mock the auth API module
vi.mock('@/shared/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
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

const mockNormalUser = {
  userId: 'user_test_user',
  userEmail: 'user@test.com',
  userName: 'Test User',
  userRole: 'user' as const,
  companyId: 'company_test_1704067200000_1',
  companyName: 'Test Company',
  departmentId: 'dept_test_1704067200000_1',
  departmentName: 'Test Department',
}

describe('useUserStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Clear localStorage
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('initial state', () => {
    it('should have default state', () => {
      vi.mocked(authApi.getCurrentUser).mockReturnValue(null)
      const store = useUserStore()

      expect(store.userInfo).toBeNull()
      expect(store.isLoggedIn).toBe(false)
      expect(store.isAdmin).toBe(false)
      expect(store.userId).toBe('')
      expect(store.userName).toBe('')
      expect(store.userEmail).toBe('')
      expect(store.companyName).toBe('')
      expect(store.departmentName).toBe('')
    })
  })

  describe('login action', () => {
    it('should login as admin successfully', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockAdminUser)
      const store = useUserStore()

      const result = await store.login('sk-admin_test_key')

      expect(result).toEqual(mockAdminUser)
      expect(store.userInfo).toEqual(mockAdminUser)
      expect(store.isLoggedIn).toBe(true)
      expect(store.isAdmin).toBe(true)
      expect(store.userId).toBe(mockAdminUser.userId)
      expect(store.userEmail).toBe(mockAdminUser.userEmail)
      expect(store.userName).toBe(mockAdminUser.userName)
    })

    it('should login as normal user successfully', async () => {
      vi.mocked(authApi.login).mockResolvedValue(mockNormalUser)
      const store = useUserStore()

      const result = await store.login('sk-user_test_key')

      expect(result).toEqual(mockNormalUser)
      expect(store.userInfo).toEqual(mockNormalUser)
      expect(store.isLoggedIn).toBe(true)
      expect(store.isAdmin).toBe(false)
    })

    it('should handle login failure', async () => {
      vi.mocked(authApi.login).mockRejectedValue(new Error('Unauthorized'))
      const store = useUserStore()

      await expect(store.login('invalid-key')).rejects.toThrow()
      expect(store.userInfo).toBeNull()
      expect(store.isLoggedIn).toBe(false)
    })

    it('should set loading state during login', async () => {
      let resolveLogin: (value: any) => void
      vi.mocked(authApi.login).mockReturnValue(new Promise(resolve => { resolveLogin = resolve }))
      const store = useUserStore()

      // Start login but don't await
      const loginPromise = store.login('sk-admin_test_key')
      expect(store.isLoading).toBe(true)

      // Resolve the login
      resolveLogin!(mockAdminUser)
      await loginPromise
      expect(store.isLoading).toBe(false)
    })
  })

  describe('logout action', () => {
    it('should clear user info on logout', () => {
      const store = useUserStore()

      // Set some user info
      store.updateUserInfo(mockAdminUser)
      expect(store.isLoggedIn).toBe(true)

      // Logout
      store.logout()

      expect(store.userInfo).toBeNull()
      expect(store.isLoggedIn).toBe(false)
      expect(store.isAdmin).toBe(false)
    })

    it('should call authApi.logout on logout', () => {
      const store = useUserStore()
      store.logout()

      expect(authApi.logout).toHaveBeenCalled()
    })

    it('should clear localStorage on logout', () => {
      // Mock logoutApi to clear localStorage
      vi.mocked(authApi.logout).mockImplementation(() => {
        localStorage.removeItem('api_key')
        localStorage.removeItem('user_info')
      })

      const store = useUserStore()

      // Set localStorage
      localStorage.setItem('api_key', 'test-key')
      localStorage.setItem('user_info', JSON.stringify(mockAdminUser))

      store.logout()

      expect(authApi.logout).toHaveBeenCalled()
      // logoutApi should have cleared the localStorage
      expect(localStorage.getItem('api_key')).toBeNull()
      expect(localStorage.getItem('user_info')).toBeNull()
    })
  })

  describe('updateUserInfo action', () => {
    it('should update user info', () => {
      const store = useUserStore()

      store.updateUserInfo(mockAdminUser)

      expect(store.userInfo).toEqual(mockAdminUser)
      expect(store.isLoggedIn).toBe(true)
      expect(store.isAdmin).toBe(true)
    })

    it('should persist to localStorage', () => {
      const store = useUserStore()

      store.updateUserInfo(mockNormalUser)

      const stored = localStorage.getItem('user_info')
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed).toEqual(mockNormalUser)
    })
  })

  describe('computed properties', () => {
    it('should return correct computed values for admin user', () => {
      const store = useUserStore()
      store.updateUserInfo(mockAdminUser)

      expect(store.isLoggedIn).toBe(true)
      expect(store.isAdmin).toBe(true)
      expect(store.userId).toBe(mockAdminUser.userId)
      expect(store.userEmail).toBe(mockAdminUser.userEmail)
      expect(store.userName).toBe(mockAdminUser.userName)
      expect(store.companyName).toBe(mockAdminUser.companyName)
      expect(store.departmentName).toBe('')
    })

    it('should return correct computed values for normal user', () => {
      const store = useUserStore()
      store.updateUserInfo(mockNormalUser)

      expect(store.isLoggedIn).toBe(true)
      expect(store.isAdmin).toBe(false)
      expect(store.userId).toBe(mockNormalUser.userId)
      expect(store.userEmail).toBe(mockNormalUser.userEmail)
      expect(store.userName).toBe(mockNormalUser.userName)
      expect(store.companyName).toBe(mockNormalUser.companyName)
      expect(store.departmentName).toBe(mockNormalUser.departmentName)
    })

    it('should fallback to email when name is not available', () => {
      const store = useUserStore()
      store.updateUserInfo({
        ...mockNormalUser,
        userName: null as any,
      })

      expect(store.userName).toBe(mockNormalUser.userEmail)
    })

    it('should return empty strings when not logged in', () => {
      const store = useUserStore()

      expect(store.isLoggedIn).toBe(false)
      expect(store.userId).toBe('')
      expect(store.userEmail).toBe('')
      expect(store.userName).toBe('')
      expect(store.companyName).toBe('')
      expect(store.departmentName).toBe('')
    })
  })
})

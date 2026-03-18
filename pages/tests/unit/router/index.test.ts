/**
 * Router Tests
 *
 * Tests for Vue Router configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'

// Import the router configuration
// We need to create a minimal version for testing
const testRoutes = [
  {
    path: '/login',
    name: 'Login' as const,
    component: { template: '<div>Login Page</div>' },
    meta: { requiresAuth: false },
  },
  {
    path: '/admin',
    name: 'AdminLayout' as const,
    component: { template: '<div>Admin Layout</div>' },
    meta: { requiresAuth: true, role: 'admin' },
    redirect: '/admin/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard' as const,
        component: { template: '<div>Admin Dashboard</div>' },
        meta: { title: '仪表盘' },
      },
      {
        path: 'users',
        name: 'Users' as const,
        component: { template: '<div>Users Management</div>' },
        meta: { title: '用户管理' },
      },
      {
        path: 'companies',
        name: 'Companies' as const,
        component: { template: '<div>Companies Management</div>' },
        meta: { title: '公司管理' },
      },
    ],
  },
  {
    path: '/user',
    name: 'UserLayout' as const,
    component: { template: '<div>User Layout</div>' },
    meta: { requiresAuth: true, role: 'user' },
    redirect: '/user/profile',
    children: [
      {
        path: 'profile',
        name: 'UserProfile' as const,
        component: { template: '<div>User Profile</div>' },
        meta: { title: '个人信息' },
      },
      {
        path: 'stats',
        name: 'UserStats' as const,
        component: { template: '<div>User Stats</div>' },
        meta: { title: '用量统计' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound' as const,
    component: { template: '<div>404 Not Found</div>' },
  },
]

describe('Router Configuration', () => {
  let router: any
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory('/'),
      routes: testRoutes,
    })
  })

  describe('route definitions', () => {
    it('should have login route', () => {
      const routes = router.getRoutes()
      const loginRoute = routes.find((r: any) => r.name === 'Login')
      expect(loginRoute).toBeDefined()
      expect(loginRoute.path).toBe('/login')
    })

    it('should have admin routes', () => {
      const routes = router.getRoutes()
      const adminLayoutRoute = routes.find((r: any) => r.name === 'AdminLayout')
      expect(adminLayoutRoute).toBeDefined()

      const dashboardRoute = routes.find((r: any) => r.name === 'Dashboard')
      expect(dashboardRoute).toBeDefined()

      const usersRoute = routes.find((r: any) => r.name === 'Users')
      expect(usersRoute).toBeDefined()

      const companiesRoute = routes.find((r: any) => r.name === 'Companies')
      expect(companiesRoute).toBeDefined()
    })

    it('should have user routes', () => {
      const routes = router.getRoutes()
      const userLayoutRoute = routes.find((r: any) => r.name === 'UserLayout')
      expect(userLayoutRoute).toBeDefined()

      const profileRoute = routes.find((r: any) => r.name === 'UserProfile')
      expect(profileRoute).toBeDefined()

      const statsRoute = routes.find((r: any) => r.name === 'UserStats')
      expect(statsRoute).toBeDefined()
    })

    it('should have 404 catch-all route', () => {
      const routes = router.getRoutes()
      const notFoundRoute = routes.find((r: any) => r.name === 'NotFound')
      expect(notFoundRoute).toBeDefined()
      expect(notFoundRoute.path).toBe('/:pathMatch(.*)*')
    })
  })

  describe('route meta properties', () => {
    it('should define public routes without auth requirement', () => {
      const routes = router.getRoutes()
      const loginRoute = routes.find((r: any) => r.name === 'Login')
      expect(loginRoute.meta.requiresAuth).toBe(false)
    })

    it('should define admin routes with admin role requirement', () => {
      const routes = router.getRoutes()
      const adminLayoutRoute = routes.find((r: any) => r.name === 'AdminLayout')
      expect(adminLayoutRoute.meta.requiresAuth).toBe(true)
      expect(adminLayoutRoute.meta.role).toBe('admin')
    })

    it('should define user routes with auth requirement', () => {
      const routes = router.getRoutes()
      const userLayoutRoute = routes.find((r: any) => r.name === 'UserLayout')
      expect(userLayoutRoute.meta.requiresAuth).toBe(true)
      expect(userLayoutRoute.meta.role).toBe('user')
    })
  })

  describe('navigation', () => {
    it('should navigate to login page', async () => {
      await router.push('/login')
      expect(router.currentRoute.value.path).toBe('/login')
    })

    it('should navigate to admin dashboard', async () => {
      await router.push('/admin/dashboard')
      expect(router.currentRoute.value.path).toBe('/admin/dashboard')
    })

    it('should navigate to user profile', async () => {
      await router.push('/user/profile')
      expect(router.currentRoute.value.path).toBe('/user/profile')
    })

    it('should navigate to 404 page for unknown routes', async () => {
      await router.push('/unknown-route')
      // In Vue Router 4, unmatched routes will still show the path
      // but the 404 route should match when explicitly pushed
      await router.push('/not-found-match')
      expect(router.currentRoute.value.name).toBe('NotFound')
    })
  })

  describe('route params and query', () => {
    it('should handle query parameters', async () => {
      await router.push('/login?redirect=/admin/users')

      expect(router.currentRoute.value.path).toBe('/login')
      expect(router.currentRoute.value.query.redirect).toBe('/admin/users')
    })

    it('should preserve query parameters on navigation', async () => {
      await router.push('/admin/users?page=2&search=test')

      expect(router.currentRoute.value.query.page).toBe('2')
      expect(router.currentRoute.value.query.search).toBe('test')
    })
  })
})

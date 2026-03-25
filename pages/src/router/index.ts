/**
 * 路由配置
 */

import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes: RouteRecordRaw[] = [
  // 登录页（管理员专用）
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/login/index.vue'),
    meta: { requiresAuth: false },
  },
  // 公开统计页面（不需要登录，通过 URL 参数传入 API Key）
  {
    path: '/stats',
    name: 'PublicStats',
    component: () => import('@/pages/public-stats/index.vue'),
    meta: { requiresAuth: false, publicPage: true },
  },
  // 管理员页面
  {
    path: '/admin',
    name: 'AdminLayout',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, role: 'admin' },
    redirect: '/admin/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/admin/dashboard/index.vue'),
        meta: { title: '仪表盘' },
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/admin/users/index.vue'),
        meta: { title: '用户管理' },
      },
      {
        path: 'companies',
        name: 'Companies',
        component: () => import('@/views/admin/companies/index.vue'),
        meta: { title: '公司管理' },
      },
      {
        path: 'departments',
        name: 'Departments',
        component: () => import('@/views/admin/departments/index.vue'),
        meta: { title: '部门管理' },
      },
      {
        path: 'keys',
        name: 'Keys',
        component: () => import('@/views/admin/keys/index.vue'),
        meta: { title: 'API Key 管理' },
      },
      {
        path: 'providers',
        name: 'Providers',
        component: () => import('@/views/admin/providers/index.vue'),
        meta: { title: '提供商管理' },
      },
      {
        path: 'models',
        name: 'Models',
        component: () => import('@/views/admin/models/index.vue'),
        meta: { title: '模型管理' },
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/admin/logs/index.vue'),
        meta: { title: '日志查询' },
      },
    ],
  },
  // 根路径重定向
  {
    path: '/',
    redirect: () => {
      const userStore = useUserStore()
      // 已登录管理员跳转到仪表盘，其他情况跳转到登录页
      return userStore.isAdmin ? '/admin/dashboard' : '/login'
    },
  },
  // 404
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/error/404.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  // 需要认证的页面（管理后台）
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }

  // 需要管理员权限的页面
  if (to.meta.role === 'admin' && !userStore.isAdmin) {
    next({ name: 'Login' })
    return
  }

  // 已登录管理员访问登录页
  if (to.name === 'Login' && userStore.isLoggedIn && userStore.isAdmin) {
    next({ name: 'Dashboard' })
    return
  }

  next()
})

export default router

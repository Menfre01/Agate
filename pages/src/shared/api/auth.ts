/**
 * 认证相关 API
 */

import { adminApi, userApi } from './request'
import type { AuthContext } from '@shared/types'

/**
 * 登录 - 验证 API Key 并获取用户信息
 *
 * 根据用户角色自动选择认证端点：
 * - Admin: /admin/auth (Admin Worker)
 * - User: /user/auth (User Worker)
 */
export async function login(apiKey: string): Promise<AuthContext> {
  // 临时存储 API key 用于请求
  const originalKey = localStorage.getItem('api_key')
  localStorage.setItem('api_key', apiKey)

  try {
    // 先尝试作为管理员登录 (Admin Worker)
    const response = await adminApi.get<AuthContext>('/admin/auth')
    if (response.userRole === 'admin') {
      // 保存 API key
      localStorage.setItem('api_key', apiKey)
      localStorage.setItem('user_info', JSON.stringify(response))
      return response
    }
    throw new Error('非管理员账户')
  } catch (error) {
    // 管理员登录失败，尝试普通用户登录 (User Worker)
    try {
      const response = await userApi.get<AuthContext>('/user/auth')
      // 保存 API key
      localStorage.setItem('api_key', apiKey)
      localStorage.setItem('user_info', JSON.stringify(response))
      return response
    } catch (userError) {
      // 清除临时存储的 API key
      localStorage.removeItem('api_key')
      throw userError
    }
  } finally {
    // 如果登录失败，恢复原来的 key
    if (!localStorage.getItem('api_key') && originalKey) {
      localStorage.setItem('api_key', originalKey)
    }
  }
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser(): AuthContext | null {
  const userInfo = localStorage.getItem('user_info')
  return userInfo ? JSON.parse(userInfo) : null
}

/**
 * 登出
 */
export function logout(): void {
  localStorage.removeItem('api_key')
  localStorage.removeItem('user_info')
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('api_key')
}

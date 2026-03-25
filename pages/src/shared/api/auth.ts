/**
 * 认证相关 API
 */

import { adminApi } from './request'
import type { AuthContext } from '@shared/types'

/**
 * 管理员登录 - 验证 API Key 并获取用户信息
 *
 * 仅用于管理后台登录，通过 /admin/auth 验证
 */
export async function login(apiKey: string): Promise<AuthContext> {
  // 先保存 API key，这样请求拦截器才能使用它
  localStorage.setItem('api_key', apiKey)

  try {
    const response = await adminApi.get<AuthContext>('/admin/auth')
    // 保存用户信息
    localStorage.setItem('user_info', JSON.stringify(response))
    return response
  } catch (error) {
    // 请求失败，清除已保存的 API key
    localStorage.removeItem('api_key')
    throw error
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

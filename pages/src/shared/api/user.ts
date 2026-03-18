/**
 * User API 封装
 *
 * 普通用户使用的 API，自动过滤到当前用户
 */

import { userApi } from './request'
import type {
  TokenUsageResponse,
  UsageStatsResponse,
  ModelStatsResponse,
  AuthContext,
} from '@shared/types/api'

/**
 * 获取当前用户信息
 */
export async function getUserInfo(): Promise<AuthContext> {
  return userApi.get('/user/auth')
}

/**
 * 获取当前用户的 Token 用量
 */
export async function getUserTokenUsage(query?: {
  period?: 'hour' | 'day' | 'week' | 'month'
}): Promise<TokenUsageResponse> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return userApi.get(`/user/stats/tokens?${params.toString()}`)
}

/**
 * 获取当前用户的使用统计
 */
export async function getUserUsageStats(query?: {
  start_at?: number
  end_at?: number
  group_by?: 'day' | 'model'
}): Promise<UsageStatsResponse> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return userApi.get(`/user/stats/usage?${params.toString()}`)
}

/**
 * 获取当前用户的模型使用统计
 */
export async function getUserModelStats(query?: {
  start_at?: number
  end_at?: number
}): Promise<{ stats: ModelStatsResponse[] }> {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value))
      }
    })
  }
  return userApi.get(`/user/stats/models?${params.toString()}`)
}

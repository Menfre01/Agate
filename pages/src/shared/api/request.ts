/**
 * Axios 请求封装
 *
 * 提供统一的 API 请求接口，自动添加认证头和错误处理
 * 支持 Admin 和 User 两个不同的 Worker
 */

import axios, { type AxiosError, type AxiosRequestConfig, type AxiosInstance } from 'axios'

// 简单的 toast 提示，用于响应拦截器
let messageApi: { error: (msg: string) => void; warning?: (msg: string) => void } | null = null

export function setMessageApi(api: { error: (msg: string) => void; warning?: (msg: string) => void }) {
  messageApi = api
}

/**
 * API 响应接口
 */
export interface ApiResponse<T = unknown> {
  error?: {
    code: string
    message: string
    request_id?: string
  }
  data?: T
}

/**
 * 通用拦截器配置
 */
function setupInterceptors(instance: AxiosInstance) {
  // 请求拦截器 - 自动添加 x-api-key 头
  instance.interceptors.request.use(
    (config: any) => {
      const apiKey = localStorage.getItem('api_key')
      if (apiKey) {
        config.headers['x-api-key'] = apiKey
      }
      return config
    },
    (error: any) => Promise.reject(error)
  )

  // 响应拦截器 - 统一处理错误，自动解包 response.data
  instance.interceptors.response.use(
    (response: any) => response.data,
    (error: AxiosError<ApiResponse>) => {
      const { response } = error
      const data = response?.data

      // 处理 401 未授权错误
      if (response?.status === 401) {
        // 如果已经在登录页面，不需要显示错误和重定向
        const isLoginPage = window.location.pathname === '/login'
        if (!isLoginPage) {
          localStorage.removeItem('api_key')
          localStorage.removeItem('user_info')
          messageApi?.error('登录已过期，请重新登录')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      // 处理 API 返回的错误信息
      if (data?.error?.message) {
        messageApi?.error(data.error.message)
        return Promise.reject(new Error(data.error.message))
      }

      // 处理网络错误
      if (error.code === 'ECONNABORTED') {
        messageApi?.error('请求超时，请稍后重试')
      } else if (error.message === 'Network Error') {
        messageApi?.error('网络连接失败，请检查网络设置')
      } else {
        messageApi?.error('请求失败，请稍后重试')
      }

      return Promise.reject(error)
    }
  )
}

/**
 * Admin API 实例 - 指向 Admin Worker
 */
const adminInstance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_WORKER_URL || 'http://localhost:8788',
  timeout: 30000,
})
setupInterceptors(adminInstance)

/**
 * 默认请求实例（向后兼容）
 */
const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_WORKER_URL || 'http://localhost:8788',
  timeout: 30000,
})
setupInterceptors(request)

/**
 * 封装的 GET 请求
 */
export function get<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  return request.get(url, config)
}

/**
 * 封装的 POST 请求
 */
export function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  return request.post(url, data, config)
}

/**
 * 封装的 PUT 请求
 */
export function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  return request.put(url, data, config)
}

/**
 * 封装的 DELETE 请求
 */
export function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  return request.delete(url, config)
}

/**
 * Admin API 专用方法
 */
export const adminApi = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => adminInstance.get<T, T>(url, config),
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => adminInstance.post<T, T>(url, data, config),
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => adminInstance.put<T, T>(url, data, config),
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => adminInstance.delete<T, T>(url, config),
}

export default request

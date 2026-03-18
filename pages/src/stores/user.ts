/**
 * 用户状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthContext } from '@shared/types/api'
import { login as loginApi, logout as logoutApi, getCurrentUser } from '@/shared/api/auth'

export const useUserStore = defineStore('user', () => {
  // 状态
  const userInfo = ref<AuthContext | null>(getCurrentUser())
  const isLoading = ref(false)

  // 计算属性
  const isLoggedIn = computed(() => !!userInfo.value)
  const isAdmin = computed(() => userInfo.value?.userRole === 'admin')
  const userId = computed(() => userInfo.value?.userId ?? '')
  const userName = computed(() => userInfo.value?.userName ?? userInfo.value?.userEmail ?? '')
  const userEmail = computed(() => userInfo.value?.userEmail ?? '')
  const companyName = computed(() => userInfo.value?.companyName ?? '')
  const departmentName = computed(() => userInfo.value?.departmentName ?? '')

  // 操作
  async function login(apiKey: string) {
    isLoading.value = true
    try {
      const user = await loginApi(apiKey)
      userInfo.value = user
      return user
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    logoutApi()
    userInfo.value = null
  }

  function updateUserInfo(info: AuthContext) {
    userInfo.value = info
    localStorage.setItem('user_info', JSON.stringify(info))
  }

  return {
    // 状态
    userInfo,
    isLoading,
    // 计算属性
    isLoggedIn,
    isAdmin,
    userId,
    userName,
    userEmail,
    companyName,
    departmentName,
    // 操作
    login,
    logout,
    updateUserInfo,
  }
})

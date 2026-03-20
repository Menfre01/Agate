<template>
  <n-layout has-sider>
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="240"
      :collapsed="collapsed"
      show-trigger
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="logo">
        <span v-if="!collapsed">Agate</span>
        <span v-else>A</span>
      </div>

      <n-menu
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="activeKey"
        @update:value="handleMenuSelect"
      />
    </n-layout-sider>

    <n-layout>
      <n-layout-header bordered class="header">
        <div class="header-content">
          <h2>{{ currentTitle }}</h2>
          <n-dropdown :options="userMenuOptions" @select="handleUserMenuSelect">
            <div class="user-info">
              <n-avatar round size="small">
                {{ userStore.userName ? userStore.userName.charAt(0).toUpperCase() : '?' }}
              </n-avatar>
              <span class="user-name">{{ userStore.userName || '未知用户' }}</span>
            </div>
          </n-dropdown>
        </div>
      </n-layout-header>

      <n-layout-content content-style="padding: 24px;">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import type { Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NAvatar,
  NDropdown,
  NIcon,
} from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import {
  UserOutlined,
  BarChartOutlined,
  LogoutOutlined,
} from '@vicons/antd'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const collapsed = ref(false)

// 图标渲染函数
const renderIcon = (icon: any) => () => h(NIcon, null, { default: () => h(icon) })

const routeMap: Record<string, string> = {
  'user-profile': '/user/profile',
  'user-stats': '/user/stats',
}

const menuOptions: MenuOption[] = [
  {
    label: '个人信息',
    key: 'user-profile',
    icon: renderIcon(UserOutlined),
  },
  {
    label: '用量统计',
    key: 'user-stats',
    icon: renderIcon(BarChartOutlined),
  },
]

const userMenuOptions = [
  {
    label: '退出登录',
    key: 'logout',
    icon: renderIcon(LogoutOutlined),
  },
]

const activeKey = computed(() => {
  const path = route.path
  if (path === '/user/profile') return 'user-profile'
  if (path === '/user/stats') return 'user-stats'
  return ''
})

const currentTitle = computed(() => {
  return route.meta.title as string || '用户中心'
})

function handleMenuSelect(key: string) {
  const path = routeMap[key]
  if (path) {
    router.push(path)
  }
}

function handleUserMenuSelect(key: string) {
  if (key === 'logout') {
    userStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
  font-size: 20px;
  font-weight: 700;
  color: #18a058;
  border-bottom: 1px solid #f0f0f0;
}

.header {
  height: 64px;
  padding: 0 24px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

.header-content h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.user-info:hover {
  background: #f5f5f5;
}

.user-name {
  font-size: 14px;
  color: #333;
}
</style>

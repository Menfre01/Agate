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
        <span v-if="!collapsed">Agate Admin</span>
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
              <n-avatar round size="small" type="info">
                {{ userStore.userName ? userStore.userName.charAt(0).toUpperCase() : '?' }}
              </n-avatar>
              <span class="user-name">{{ userStore.userName || '未知用户' }}</span>
              <n-tag size="small" :type="userStore.isAdmin ? 'info' : 'warning'">
                {{ userStore.userInfo?.userRole || '未知角色' }}
              </n-tag>
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
import { useRouter, useRoute } from 'vue-router'
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NAvatar,
  NDropdown,
  NTag,
  NIcon,
} from 'naive-ui'
import type { MenuOption } from 'naive-ui'
// PRD V2 第一期：仅导入需要的图标
import {
  DashboardOutlined,
  UserOutlined,
  KeyOutlined,
  CloudServerOutlined,
  RobotOutlined,
  FileTextOutlined,
  LogoutOutlined,
} from '@vicons/antd'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const collapsed = ref(false)

// 图标渲染函数
const renderIcon = (icon: any) => () => h(NIcon, null, { default: () => h(icon) })

// PRD V2 第一期：路由映射（仅核心管理功能）
const routeMap: Record<string, string> = {
  'admin-dashboard': '/admin/dashboard',
  'admin-users': '/admin/users',
  'admin-keys': '/admin/keys',
  'admin-providers': '/admin/providers',
  'admin-models': '/admin/models',
  'admin-logs': '/admin/logs',
}

// PRD V2 第一期：仅保留核心管理功能，隐藏仪表盘、公司、部门管理
const menuOptions: MenuOption[] = [
  {
    label: '仪表盘',
    key: 'admin-dashboard',
    icon: renderIcon(DashboardOutlined),
  },
  {
    label: '用户管理',
    key: 'admin-users',
    icon: renderIcon(UserOutlined),
  },
  {
    label: 'API Key 管理',
    key: 'admin-keys',
    icon: renderIcon(KeyOutlined),
  },
  {
    label: '提供商管理',
    key: 'admin-providers',
    icon: renderIcon(CloudServerOutlined),
  },
  {
    label: '模型管理',
    key: 'admin-models',
    icon: renderIcon(RobotOutlined),
  },
  {
    label: '日志查询',
    key: 'admin-logs',
    icon: renderIcon(FileTextOutlined),
  },
]

const userMenuOptions = [
  {
    label: '退出登录',
    key: 'logout',
    icon: renderIcon(LogoutOutlined),
  },
]

// PRD V2 第一期：仅保留核心管理功能
const activeKey = computed(() => {
  const path = route.path
  if (path.startsWith('/admin/dashboard')) return 'admin-dashboard'
  if (path.startsWith('/admin/users')) return 'admin-users'
  if (path.startsWith('/admin/keys')) return 'admin-keys'
  if (path.startsWith('/admin/providers')) return 'admin-providers'
  if (path.startsWith('/admin/models')) return 'admin-models'
  if (path.startsWith('/admin/logs')) return 'admin-logs'
  return ''
})

const currentTitle = computed(() => {
  return route.meta.title as string || '管理后台'
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
  font-size: 18px;
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

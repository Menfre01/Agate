<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <h1>404</h1>
      <p>页面不存在</p>
      <n-button type="primary" @click="goHome">返回首页</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

function goHome() {
  if (userStore.isAdmin) {
    router.push('/admin')
  } else {
    router.push('/user')
  }
}
</script>

<style scoped>
.not-found-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f5f5;
}

.not-found-content {
  text-align: center;
}

.not-found-content h1 {
  font-size: 120px;
  font-weight: 700;
  color: #667eea;
  margin: 0;
  line-height: 1;
}

.not-found-content p {
  font-size: 20px;
  color: #666;
  margin: 16px 0 32px;
}
</style>

<template>
  <div class="login-container">
    <div class="login-box">
      <div class="logo-section">
        <h1>Agate</h1>
        <p>管理后台登录</p>
      </div>

      <n-alert type="info" :show-icon="false" style="margin-bottom: 24px;">
        <template #header>
          <span style="font-size: 13px;">普通用户请访问 <a href="/stats">/stats</a> 查看用量统计</span>
        </template>
      </n-alert>

      <n-form ref="formRef" :model="formData" :rules="rules" size="large">
        <n-form-item path="apiKey" label="管理员 API Key">
          <n-input
            v-model:value="formData.apiKey"
            type="password"
            show-password-on="click"
            placeholder="请输入管理员 API Key"
            @keyup.enter="handleLogin"
          />
        </n-form-item>

        <n-form-item>
          <n-button
            type="primary"
            block
            :loading="loading"
            @click="handleLogin"
          >
            登录管理后台
          </n-button>
        </n-form-item>
      </n-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NForm, NFormItem, NInput, NButton, NAlert, useMessage } from 'naive-ui'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const userStore = useUserStore()

const formRef = ref()
const loading = ref(false)

const formData = reactive({
  apiKey: '',
})

const rules = {
  apiKey: [
    { required: true, message: '请输入 API Key', trigger: 'blur' },
    { min: 10, message: 'API Key 格式不正确', trigger: 'blur' },
  ],
}

async function handleLogin() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const userInfo = await userStore.login(formData.apiKey)

    // 验证是否为管理员
    if (userInfo.userRole !== 'admin') {
      message.error('此 API Key 不是管理员权限，普通用户请访问 /stats 查看用量统计')
      return
    }

    message.success(`欢迎回来，${userInfo.userName || userInfo.userEmail}！`)

    // 跳转到管理后台
    const redirect = route.query.redirect as string
    await router.push(redirect || '/admin/dashboard')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '登录失败，请检查 API Key')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.logo-section {
  text-align: center;
  margin-bottom: 32px;
}

.logo-section h1 {
  font-size: 32px;
  font-weight: 700;
  color: #333;
  margin-bottom: 8px;
}

.logo-section p {
  font-size: 14px;
  color: #666;
}

a {
  color: #18a058;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>

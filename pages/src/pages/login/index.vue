<template>
  <div class="login-container">
    <div class="login-box">
      <div class="logo-section">
        <h1>Agate</h1>
        <p>AI Gateway 管理后台</p>
      </div>

      <n-form ref="formRef" :model="formData" :rules="rules" size="large">
        <n-form-item path="apiKey" label="API Key">
          <n-input
            v-model:value="formData.apiKey"
            type="password"
            show-password-on="click"
            placeholder="请输入您的 API Key"
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
            登录
          </n-button>
        </n-form-item>
      </n-form>

      <div class="tips">
        <p>使用您的 API Key 登录管理后台</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
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
    message.success(`欢迎回来，${userInfo.userName || userInfo.userEmail}！`)

    // 重定向到原页面或默认页面
    const redirect = route.query.redirect as string
    if (redirect) {
      router.push(redirect)
    } else if (userInfo.userRole === 'admin') {
      router.push('/admin')
    } else {
      router.push('/user')
    }
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

.tips {
  margin-top: 24px;
  text-align: center;
}

.tips p {
  font-size: 13px;
  color: #999;
}
</style>

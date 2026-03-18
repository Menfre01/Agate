<template>
  <div class="providers-page">
    <n-card title="提供商管理">
      <template #header-extra>
        <n-button type="primary" @click="showCreateModal = true">新建提供商</n-button>
      </template>

      <n-data-table
        :columns="columns"
        :data="providers"
        :loading="loading"
        :bordered="false"
      />
    </n-card>

    <!-- 创建提供商弹窗 -->
    <n-modal v-model:show="showCreateModal" preset="dialog" title="新建提供商">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" :label-width="100">
        <n-form-item label="标识符" path="name">
          <n-input v-model:value="formData.name" placeholder="例如: anthropic, openai" />
        </n-form-item>
        <n-form-item label="显示名称" path="display_name">
          <n-input v-model:value="formData.display_name" placeholder="例如: Anthropic Claude" />
        </n-form-item>
        <n-form-item label="API 地址" path="base_url">
          <n-input v-model:value="formData.base_url" placeholder="https://api.anthropic.com" />
        </n-form-item>
        <n-form-item label="API 版本" path="api_version">
          <n-input v-model:value="formData.api_version" placeholder="例如: 2023-06-01（可选）" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showCreateModal = false">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="handleCreate">确定</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import {
  NCard,
  NButton,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NTag,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { getProviders } from '@/shared/api/admin'

const loading = ref(false)
const providers = ref<any[]>([])
const showCreateModal = ref(false)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

const formData = reactive({
  name: '',
  display_name: '',
  base_url: '',
  api_version: '',
})

const rules: FormRules = {
  name: { required: true, message: '请输入标识符', trigger: 'blur' },
  display_name: { required: true, message: '请输入显示名称', trigger: 'blur' },
  base_url: { required: true, message: '请输入 API 地址', trigger: 'blur' },
}

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '标识符', key: 'name', width: 120 },
  { title: '显示名称', key: 'display_name', width: 200 },
  { title: 'API 地址', key: 'base_url', width: 300, ellipsis: { tooltip: true } },
  { title: 'API 版本', key: 'api_version', width: 120 },
  {
    title: '状态',
    key: 'is_active',
    width: 80,
    render: (row) => h(NTag, { type: row.is_active ? 'success' : 'default', size: 'small' }, () => (row.is_active ? '启用' : '禁用')),
  },
  { title: '凭证数', key: 'credential_count', width: 80 },
  { title: '创建时间', key: 'created_at', width: 180, render: (row) => formatDate(row.created_at) },
]

async function loadProviders() {
  loading.value = true
  try {
    const result = await getProviders()
    providers.value = result.providers
  } catch (error) {
    console.error('Failed to load providers:', error)
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  try {
    await formRef.value?.validate()
    submitting.value = true
    // TODO: 调用创建提供商 API
    console.log('Create provider:', formData)
    showCreateModal.value = false
    await loadProviders()
  } catch (error) {
    console.error('Failed to create provider:', error)
  } finally {
    submitting.value = false
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => loadProviders())
</script>

<style scoped>
.providers-page {
  max-width: 1400px;
}
</style>

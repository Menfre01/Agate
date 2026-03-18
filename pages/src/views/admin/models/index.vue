<template>
  <div class="models-page">
    <n-card title="模型管理">
      <template #header-extra>
        <n-button type="primary" @click="showCreateModal = true">新建模型</n-button>
      </template>

      <n-data-table
        :columns="columns"
        :data="models"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
      />
    </n-card>

    <!-- 创建模型弹窗 -->
    <n-modal v-model:show="showCreateModal" preset="dialog" title="新建模型">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" :label-width="100">
        <n-form-item label="模型 ID" path="model_id">
          <n-input v-model:value="formData.model_id" placeholder="例如: claude-3-sonnet" />
        </n-form-item>
        <n-form-item label="显示名称" path="display_name">
          <n-input v-model:value="formData.display_name" placeholder="例如: Claude 3 Sonnet" />
        </n-form-item>
        <n-form-item label="上下文窗口" path="context_window">
          <n-input-number v-model:value="formData.context_window" :min="0" style="width: 100%;" />
        </n-form-item>
        <n-form-item label="最大输出" path="max_tokens">
          <n-input-number v-model:value="formData.max_tokens" :min="0" style="width: 100%;" />
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
import { ref, reactive, onMounted } from 'vue'
import {
  NCard,
  NButton,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NTag,
  NCollapse,
  NCollapseItem,
  NDataTable as NInnerDataTable,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { getModels } from '@/shared/api/admin'

const loading = ref(false)
const models = ref<any[]>([])
const showCreateModal = ref(false)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const formData = reactive({
  model_id: '',
  display_name: '',
  context_window: 200000,
  max_tokens: 4096,
})

const rules: FormRules = {
  model_id: { required: true, message: '请输入模型 ID', trigger: 'blur' },
  display_name: { required: true, message: '请输入显示名称', trigger: 'blur' },
}

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '模型 ID', key: 'model_id', width: 180 },
  { title: '显示名称', key: 'display_name', width: 200 },
  { title: '上下文窗口', key: 'context_window', width: 120, render: (row) => row.context_window.toLocaleString() },
  { title: '最大输出', key: 'max_tokens', width: 100, render: (row) => row.max_tokens.toLocaleString() },
  {
    title: '状态',
    key: 'is_active',
    width: 80,
    render: (row) => h(NTag, { type: row.is_active ? 'success' : 'default', size: 'small' }, () => (row.is_active ? '启用' : '禁用')),
  },
  { title: '提供商数量', key: 'providers', width: 100, render: (row) => row.providers?.length || 0 },
  { title: '创建时间', key: 'created_at', width: 180, render: (row) => formatDate(row.created_at) },
]

import { h } from 'vue'

async function loadModels() {
  loading.value = true
  try {
    const result = await getModels()
    models.value = result.models
    pagination.itemCount = result.total
  } catch (error) {
    console.error('Failed to load models:', error)
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  try {
    await formRef.value?.validate()
    submitting.value = true
    // TODO: 调用创建模型 API
    console.log('Create model:', formData)
    showCreateModal.value = false
    await loadModels()
  } catch (error) {
    console.error('Failed to create model:', error)
  } finally {
    submitting.value = false
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => loadModels())
</script>

<style scoped>
.models-page {
  max-width: 1400px;
}
</style>

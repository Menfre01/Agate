<template>
  <div class="models-page">
    <n-card title="模型管理">
      <template #header-extra>
        <n-button type="primary" @click="openCreateModal">新建模型</n-button>
      </template>

      <n-data-table
        :columns="columns"
        :data="models"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
      />
    </n-card>

    <!-- 创建/编辑模型弹窗 -->
    <n-modal v-model:show="showModal" preset="dialog" :title="isEdit ? '编辑模型' : '新建模型'">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" :label-width="100">
        <n-form-item label="模型 ID" path="model_id">
          <n-input v-model:value="formData.model_id" placeholder="例如: claude-3-sonnet" :disabled="isEdit" />
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
          <n-button @click="closeModal">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="handleSubmit">确定</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 提供商关联弹窗 -->
    <n-modal v-model:show="showProviderModal" preset="dialog" title="提供商关联">
      <n-space vertical>
        <n-button type="primary" @click="openAddProviderModal">添加提供商</n-button>
        <n-list>
          <n-list-item v-for="mp in modelProviders" :key="mp.provider_id">
            <template #prefix>
              <n-tag type="info" size="small">{{ mp.provider_name }}</n-tag>
            </template>
            <n-space vertical>
              <div>优先级: {{ mp.priority }}</div>
              <div v-if="mp.pricing" class="pricing-detail">
                输入: ${{ mp.pricing.input_per_million }}/M | 输出: ${{ mp.pricing.output_per_million }}/M
              </div>
            </n-space>
            <template #suffix>
              <n-popconfirm @positive-click="() => handleRemoveProvider(mp.provider_id)">
                <template #trigger>
                  <n-button size="tiny" type="error">移除</n-button>
                </template>
                确定移除此提供商？
              </n-popconfirm>
            </template>
          </n-list-item>
        </n-list>
      </n-space>
      <template #action>
        <n-button @click="showProviderModal = false">关闭</n-button>
      </template>
    </n-modal>

    <!-- 添加提供商弹窗 -->
    <n-modal v-model:show="showAddProviderModal" preset="dialog" title="添加提供商">
      <n-form ref="providerFormRef" :model="providerData" :rules="providerRules" label-placement="left" :label-width="100">
        <n-form-item label="提供商" path="provider_id">
          <n-select v-model:value="providerData.provider_id" :options="availableProviders" placeholder="选择提供商" />
        </n-form-item>
        <n-form-item label="优先级" path="priority">
          <n-input-number v-model:value="providerData.priority" :min="0" style="width: 100%;" />
        </n-form-item>
        <n-divider />
        <n-text depth="3" style="font-size: 12px;">定价（可选）</n-text>
        <n-form-item label="输入价格" path="input_per_million">
          <n-input-number v-model:value="providerData.input_per_million" :min="0" :precision="4" style="width: 100;" />
          <template #feedback>每百万 Token 价格（美元）</template>
        </n-form-item>
        <n-form-item label="输出价格" path="output_per_million">
          <n-input-number v-model:value="providerData.output_per_million" :min="0" :precision="4" style="width: 100;" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showAddProviderModal = false">取消</n-button>
          <n-button type="primary" :loading="providerSubmitting" @click="handleAddProvider">确定</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h, computed } from 'vue'
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
  NSpace,
  NList,
  NListItem,
  NPopconfirm,
  NSelect,
  NDivider,
  NText,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import {
  getModels,
  createModel,
  updateModel,
  deleteModel,
  getProviders,
  addModelProvider,
  removeModelProvider,
} from '@/shared/api/admin'
import { useMessage } from 'naive-ui'

const message = useMessage()
const loading = ref(false)
const models = ref<any[]>([])
const allProviders = ref<any[]>([])

const showModal = ref(false)
const isEdit = ref(false)
const editId = ref('')
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const showProviderModal = ref(false)
const showAddProviderModal = ref(false)
const providerSubmitting = ref(false)
const providerFormRef = ref<FormInst | null>(null)
const modelProviders = ref<any[]>([])
const currentModelId = ref('')

const formData = reactive({
  model_id: '',
  display_name: '',
  context_window: 200000,
  max_tokens: 4096,
})

const providerData = reactive({
  provider_id: '',
  priority: 0,
  input_per_million: 0,
  output_per_million: 0,
})

const rules: FormRules = {
  model_id: { required: true, message: '请输入模型 ID', trigger: 'blur' },
  display_name: { required: true, message: '请输入显示名称', trigger: 'blur' },
}

const providerRules: FormRules = {
  provider_id: { required: true, message: '请选择提供商', trigger: 'change', type: 'string' },
}

const availableProviders = computed(() => {
  const linkedIds = new Set(modelProviders.value.map((mp) => mp.provider_id))
  return allProviders.value
    .filter((p) => !linkedIds.has(p.id))
    .map((p) => ({ label: `${p.display_name} (${p.name})`, value: p.id }))
})

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
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right' as const,
    render: (row) => h(NSpace, {}, () => [
      h(NButton, { size: 'small', onClick: () => openProviderModal(row) }, () => '提供商'),
      h(NButton, { size: 'small', onClick: () => openEditModal(row) }, () => '编辑'),
      h(
        NPopconfirm,
        { onPositiveClick: () => handleDelete(row) },
        {
          trigger: () => h(NButton, { size: 'small', type: 'error' }, () => '删除'),
          default: () => '确定删除此模型？',
        }
      ),
    ]),
  },
]

async function loadModels() {
  loading.value = true
  try {
    const result = await getModels()
    models.value = result.models
    pagination.itemCount = result.total
  } catch (error: any) {
    message.error(error.message || '加载模型列表失败')
  } finally {
    loading.value = false
  }
}

async function loadProviders() {
  try {
    const result = await getProviders()
    allProviders.value = result.providers
  } catch (error: any) {
    message.error(error.message || '加载提供商列表失败')
  }
}

function openCreateModal() {
  isEdit.value = false
  formData.model_id = ''
  formData.display_name = ''
  formData.context_window = 200000
  formData.max_tokens = 4096
  showModal.value = true
}

function openEditModal(row: any) {
  isEdit.value = true
  editId.value = row.id
  formData.model_id = row.model_id
  formData.display_name = row.display_name
  formData.context_window = row.context_window
  formData.max_tokens = row.max_tokens
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  formData.model_id = ''
  formData.display_name = ''
  formData.context_window = 200000
  formData.max_tokens = 4096
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    submitting.value = true

    if (isEdit.value) {
      await updateModel(editId.value, {
        display_name: formData.display_name,
        context_window: formData.context_window,
        max_tokens: formData.max_tokens,
      })
      message.success('模型更新成功')
    } else {
      await createModel({
        model_id: formData.model_id,
        display_name: formData.display_name,
        context_window: formData.context_window,
        max_tokens: formData.max_tokens,
      })
      message.success('模型创建成功')
    }

    closeModal()
    await loadModels()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await deleteModel(row.id)
    message.success('模型已删除')
    await loadModels()
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}

function openProviderModal(row: any) {
  currentModelId.value = row.id
  modelProviders.value = row.providers?.map((p: any) => ({
    provider_id: p.id,
    provider_name: p.display_name || p.name,
    priority: p.priority || 0,
    pricing: p.pricing,
  })) || []
  showProviderModal.value = true
}

function openAddProviderModal() {
  providerData.provider_id = ''
  providerData.priority = 0
  providerData.input_per_million = 0
  providerData.output_per_million = 0
  showAddProviderModal.value = true
}

async function handleAddProvider() {
  try {
    await providerFormRef.value?.validate()
    providerSubmitting.value = true

    // AddModelProviderDto 使用 input_price 和 output_price（每 1K tokens）
    const data: any = {
      provider_id: providerData.provider_id,
    }
    if (providerData.input_per_million > 0 || providerData.output_per_million > 0) {
      data.input_price = providerData.input_per_million / 1000
      data.output_price = providerData.output_per_million / 1000
    }

    await addModelProvider(currentModelId.value, data)

    message.success('提供商添加成功')
    showAddProviderModal.value = false

    // 刷新模型数据以更新提供商列表
    await loadModels()
    const model = models.value.find((m) => m.id === currentModelId.value)
    if (model) {
      modelProviders.value = model.providers?.map((p: any) => ({
        provider_id: p.id,
        provider_name: p.display_name || p.name,
        priority: p.priority || 0,
        pricing: p.pricing,
      })) || []
    }
  } catch (error: any) {
    message.error(error.message || '添加提供商失败')
  } finally {
    providerSubmitting.value = false
  }
}

async function handleRemoveProvider(providerId: string) {
  try {
    await removeModelProvider(currentModelId.value, providerId)
    message.success('提供商已移除')

    // 刷新模型数据以更新提供商列表
    await loadModels()
    const model = models.value.find((m) => m.id === currentModelId.value)
    if (model) {
      modelProviders.value = model.providers?.map((p: any) => ({
        provider_id: p.id,
        provider_name: p.display_name || p.name,
        priority: p.priority || 0,
        pricing: p.pricing,
      })) || []
    }
  } catch (error: any) {
    message.error(error.message || '移除提供商失败')
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => {
  loadModels()
  loadProviders()
})
</script>

<style scoped>
.models-page {
  max-width: 1400px;
}

.pricing-detail {
  font-size: 12px;
  color: #666;
}
</style>

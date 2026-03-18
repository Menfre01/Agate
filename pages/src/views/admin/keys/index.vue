<template>
  <div class="keys-page">
    <n-card title="API Key 管理">
      <template #header-extra>
        <n-button type="primary" @click="showCreateModal = true">新建 API Key</n-button>
      </template>

      <n-space vertical style="margin-bottom: 16px;">
        <n-space>
          <n-input v-model:value="searchText" placeholder="搜索 Key 或用户" clearable style="width: 200px;" />
          <n-select v-model:value="statusFilter" :options="statusOptions" placeholder="选择状态" clearable style="width: 120px;" />
          <n-button @click="loadKeys">搜索</n-button>
        </n-space>
      </n-space>

      <n-data-table
        :columns="columns"
        :data="keys"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
      />
    </n-card>

    <!-- 创建 API Key 弹窗 -->
    <n-modal v-model:show="showCreateModal" preset="dialog" title="新建 API Key">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" :label-width="100">
        <n-form-item label="用户" path="user_id">
          <n-select v-model:value="formData.user_id" :options="userOptions" placeholder="选择用户" filterable />
        </n-form-item>
        <n-form-item label="Key 名称" path="name">
          <n-input v-model:value="formData.name" placeholder="Key 名称（可选）" />
        </n-form-item>
        <n-form-item label="每日配额" path="quota_daily">
          <n-input-number v-model:value="formData.quota_daily" :min="0" style="width: 100%;" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showCreateModal = false">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="handleCreate">确定</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 显示新创建的 Key -->
    <n-modal v-model:show="showKeyResult" preset="dialog" title="API Key 创建成功">
      <n-alert type="warning" style="margin-bottom: 16px;">
        请立即复制此 API Key，关闭后将无法再次查看完整内容
      </n-alert>
      <n-input :value="newKey" type="textarea" readonly :rows="3" />
      <template #action>
        <n-space>
          <n-button @click="showKeyResult = false">关闭</n-button>
          <n-button type="primary" @click="copyKey">复制</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import {
  NCard,
  NSpace,
  NButton,
  NInput,
  NSelect,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInputNumber,
  NAlert,
  NTag,
  NPopconfirm,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { getKeys, createKey } from '@/shared/api/admin'
import { getUsers } from '@/shared/api/admin'

const loading = ref(false)
const keys = ref<any[]>([])
const searchText = ref('')
const statusFilter = ref<'true' | 'false' | null>(null)
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const statusOptions = [
  { label: '启用', value: 'true' as const },
  { label: '禁用', value: 'false' as const },
]

const columns: DataTableColumns<any> = [
  { title: 'Key ID', key: 'id', width: 100 },
  { title: 'Key 前缀', key: 'key_prefix', width: 150 },
  { title: '名称', key: 'name', width: 150 },
  { title: '用户', key: 'user_email', width: 200 },
  {
    title: '配额',
    key: 'quota_daily',
    width: 180,
    render: (row) => {
      const total = row.quota_daily + (row.quota_bonus || 0)
      const used = row.quota_used
      const percent = total > 0 ? (used / total) * 100 : 0
      return `${used.toLocaleString()} / ${total.toLocaleString()} (${percent.toFixed(1)}%)`
    },
  },
  {
    title: '状态',
    key: 'is_active',
    width: 100,
    render: (row) => h(NTag, { type: row.is_active ? 'success' : 'default', size: 'small' }, () => (row.is_active ? '启用' : '禁用')),
  },
  { title: '最后使用', key: 'last_used_at', width: 180, render: (row) => (row.last_used_at ? formatDate(row.last_used_at) : '从未使用') },
  { title: '创建时间', key: 'created_at', width: 180, render: (row) => formatDate(row.created_at) },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render: (row) => h(NSpace, {}, () => [
      h(NButton, { size: 'small', onClick: () => handleAddBonus(row) }, () => '奖励配额'),
      h(NPopconfirm, { onPositiveClick: () => handleDisable(row) }, {
        trigger: () => h(NButton, { size: 'small', type: row.is_active ? 'warning' : 'success' }, () => row.is_active ? '禁用' : '启用'),
        default: () => `确定${row.is_active ? '禁用' : '启用'}此 Key?`,
      }),
    ]),
  },
]

import { h } from 'vue'

const showCreateModal = ref(false)
const showKeyResult = ref(false)
const submitting = ref(false)
const newKey = ref('')
const formRef = ref<FormInst | null>(null)
const userOptions = ref<{ label: string; value: string }[]>([])

const formData = reactive({
  user_id: '',
  name: '',
  quota_daily: 100000,
})

const rules: FormRules = {
  user_id: { required: true, message: '请选择用户', trigger: 'change', type: 'string' },
  quota_daily: { required: true, message: '请输入每日配额', trigger: 'blur', type: 'number' },
}

async function loadKeys() {
  loading.value = true
  try {
    const result = await getKeys({ page: pagination.page, page_size: pagination.pageSize })
    keys.value = result.keys
    pagination.itemCount = result.total
  } catch (error) {
    console.error('Failed to load keys:', error)
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  try {
    const result = await getUsers({ page: 1, page_size: 1000 })
    userOptions.value = result.users.map((u) => ({ label: `${u.name || u.email} (${u.email})`, value: u.id }))
  } catch (error) {
    console.error('Failed to load users:', error)
  }
}

async function handleCreate() {
  try {
    await formRef.value?.validate()
    submitting.value = true
    const result = await createKey({
      user_id: formData.user_id,
      name: formData.name || undefined,
      quota_daily: formData.quota_daily,
    })
    newKey.value = result.key || ''
    showCreateModal.value = false
    showKeyResult.value = true
    await loadKeys()
  } catch (error) {
    console.error('Failed to create key:', error)
  } finally {
    submitting.value = false
  }
}

function copyKey() {
  navigator.clipboard.writeText(newKey.value)
}

function handleAddBonus(row: any) {
  // TODO: 实现添加奖励配额
  console.log('Add bonus for key:', row.id)
}

async function handleDisable(row: any) {
  // TODO: 实现禁用/启用 Key
  console.log('Toggle status for key:', row.id)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => {
  loadKeys()
  loadUsers()
})
</script>

<style scoped>
.keys-page {
  max-width: 1400px;
}
</style>

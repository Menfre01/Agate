<template>
  <div class="providers-page">
    <n-card title="提供商管理">
      <template #header-extra>
        <n-button type="primary" @click="openCreateModal">新建提供商</n-button>
      </template>

      <n-data-table
        :columns="columns"
        :data="providers"
        :loading="loading"
        :pagination="false"
        :bordered="false"
      />
      <n-space justify="end" style="margin-top: 16px;">
        <n-pagination
          v-model:page="currentPage"
          v-model:page-size="pageSize"
          :item-count="totalItems"
          :page-sizes="[10, 20, 50, 100]"
          show-size-picker
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </n-space>
    </n-card>

    <!-- 创建/编辑提供商弹窗 -->
    <n-modal v-model:show="showModal" preset="dialog" :title="isEdit ? '编辑提供商' : '新建提供商'">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" :label-width="100">
        <n-form-item label="标识符" path="name">
          <n-input v-model:value="formData.name" placeholder="例如: anthropic, openai" :disabled="isEdit" />
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
          <n-button @click="closeModal">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="handleSubmit">确定</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 凭证管理弹窗 -->
    <n-modal v-model:show="showCredentialModal" preset="dialog" title="凭证管理">
      <n-space vertical>
        <n-button type="primary" @click="openAddCredentialModal">添加凭证</n-button>
        <n-list>
          <n-list-item v-for="cred in credentials" :key="cred.id">
            <template #prefix>
              <n-tag :type="cred.is_active ? 'success' : 'default'" size="small">
                {{ cred.is_active ? '启用' : '禁用' }}
              </n-tag>
            </template>
            <n-space vertical>
              <div><strong>{{ cred.credential_name }}</strong></div>
              <div v-if="cred.base_url" class="credential-detail">URL: {{ cred.base_url }}</div>
              <div class="credential-detail">
                状态: {{ cred.health_status || '未知' }}
                <span v-if="cred.last_health_check" class="health-time">
                  ({{ formatDate(cred.last_health_check) }})
                </span>
              </div>
            </n-space>
            <template #suffix>
              <n-popconfirm @positive-click="() => handleDeleteCredential(cred.id)">
                <template #trigger>
                  <n-button size="tiny" type="error">删除</n-button>
                </template>
                确定删除此凭证？
              </n-popconfirm>
            </template>
          </n-list-item>
        </n-list>
      </n-space>
      <template #action>
        <n-button @click="showCredentialModal = false">关闭</n-button>
      </template>
    </n-modal>

    <!-- 添加凭证弹窗 -->
    <n-modal v-model:show="showAddCredentialModal" preset="dialog" title="添加凭证">
      <n-form ref="credentialFormRef" :model="credentialData" :rules="credentialRules" label-placement="left" :label-width="100">
        <n-form-item label="凭证名称" path="credential_name">
          <n-input v-model:value="credentialData.credential_name" placeholder="例如: default" />
        </n-form-item>
        <n-form-item label="API Key" path="api_key">
          <n-input v-model:value="credentialData.api_key" type="password" show-password-on="click" placeholder="sk-..." />
        </n-form-item>
        <n-form-item label="API 地址" path="base_url">
          <n-input v-model:value="credentialData.base_url" placeholder="留空使用提供商默认地址（可选）" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showAddCredentialModal = false">取消</n-button>
          <n-button type="primary" :loading="credentialSubmitting" @click="handleAddCredential">确定</n-button>
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
  NPagination,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NTag,
  NSpace,
  NList,
  NListItem,
  NPopconfirm,
  NInputNumber,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import {
  getProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  getProviderCredentials,
  addCredential,
  deleteCredential,
} from '@/shared/api/admin'
import { useMessage } from 'naive-ui'

const message = useMessage()
const loading = ref(false)
const providers = ref<any[]>([])

// 分页状态
const currentPage = ref(1)
const pageSize = ref(10)
const totalItems = ref(0)

const showModal = ref(false)
const isEdit = ref(false)
const editId = ref('')
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

const showCredentialModal = ref(false)
const showAddCredentialModal = ref(false)
const credentialSubmitting = ref(false)
const credentialFormRef = ref<FormInst | null>(null)
const credentials = ref<any[]>([])
const currentProviderId = ref('')

const formData = reactive({
  name: '',
  display_name: '',
  base_url: '',
  api_version: '',
})

// PRD V2 第一期：移除 priority 和 weight，使用一致性哈希
const credentialData = reactive({
  credential_name: '',
  api_key: '',
  base_url: '',
})

const rules: FormRules = {
  name: { required: true, message: '请输入标识符', trigger: 'blur' },
  display_name: { required: true, message: '请输入显示名称', trigger: 'blur' },
  base_url: { required: true, message: '请输入 API 地址', trigger: 'blur' },
}

const credentialRules: FormRules = {
  credential_name: { required: true, message: '请输入凭证名称', trigger: 'blur' },
  api_key: { required: true, message: '请输入 API Key', trigger: 'blur' },
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
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right' as const,
    render: (row) => h(NSpace, {}, () => [
      h(NButton, { size: 'small', onClick: () => openCredentialModal(row.id) }, () => '凭证'),
      h(NButton, { size: 'small', onClick: () => openEditModal(row) }, () => '编辑'),
      h(
        NPopconfirm,
        { onPositiveClick: () => handleDelete(row) },
        {
          trigger: () => h(NButton, { size: 'small', type: 'error' }, () => '删除'),
          default: () => '确定删除此提供商？',
        }
      ),
    ]),
  },
]

async function loadProviders() {
  loading.value = true
  try {
    const result = await getProviders({
      page: currentPage.value,
      page_size: pageSize.value,
    })
    providers.value = result.providers
    totalItems.value = result.total
  } catch (error: any) {
    message.error(error.message || '加载提供商列表失败')
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadProviders()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  loadProviders()
}

function openCreateModal() {
  isEdit.value = false
  formData.name = ''
  formData.display_name = ''
  formData.base_url = ''
  formData.api_version = ''
  showModal.value = true
}

function openEditModal(row: any) {
  isEdit.value = true
  editId.value = row.id
  formData.name = row.name
  formData.display_name = row.display_name
  formData.base_url = row.base_url
  formData.api_version = row.api_version || ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  formData.name = ''
  formData.display_name = ''
  formData.base_url = ''
  formData.api_version = ''
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    submitting.value = true

    if (isEdit.value) {
      await updateProvider(editId.value, {
        display_name: formData.display_name,
        base_url: formData.base_url,
        api_version: formData.api_version || undefined,
      })
      message.success('提供商更新成功')
    } else {
      await createProvider({
        name: formData.name,
        display_name: formData.display_name,
        base_url: formData.base_url,
        api_version: formData.api_version || undefined,
      })
      message.success('提供商创建成功')
    }

    closeModal()
    await loadProviders()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await deleteProvider(row.id)
    message.success('提供商已删除')
    if (providers.value.length === 1 && currentPage.value > 1) {
      currentPage.value--
    }
    await loadProviders()
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}

async function openCredentialModal(providerId: string) {
  currentProviderId.value = providerId
  showCredentialModal.value = true
  await loadCredentials(providerId)
}

async function loadCredentials(providerId: string) {
  try {
    const result = await getProviderCredentials(providerId)
    credentials.value = result.credentials || []
  } catch (error: any) {
    message.error(error.message || '加载凭证失败')
  }
}

function openAddCredentialModal() {
  credentialData.credential_name = ''
  credentialData.api_key = ''
  credentialData.base_url = ''
  showAddCredentialModal.value = true
}

async function handleAddCredential() {
  try {
    await credentialFormRef.value?.validate()
    credentialSubmitting.value = true

    // PRD V2 第一期：移除 priority 和 weight，使用一致性哈希
    await addCredential(currentProviderId.value, {
      credential_name: credentialData.credential_name,
      api_key: credentialData.api_key,
      base_url: credentialData.base_url || undefined,
    })

    message.success('凭证添加成功')
    showAddCredentialModal.value = false
    await loadCredentials(currentProviderId.value)
  } catch (error: any) {
    message.error(error.message || '添加凭证失败')
  } finally {
    credentialSubmitting.value = false
  }
}

async function handleDeleteCredential(credentialId: string) {
  try {
    await deleteCredential(currentProviderId.value, credentialId)
    message.success('凭证已删除')
    await loadCredentials(currentProviderId.value)
  } catch (error: any) {
    message.error(error.message || '删除凭证失败')
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

.credential-detail {
  font-size: 12px;
  color: #666;
}
</style>

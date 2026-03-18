<template>
  <div class="companies-page">
    <n-card title="公司管理">
      <template #header-extra>
        <n-button type="primary" @click="showCreateModal = true">新建公司</n-button>
      </template>
      <n-data-table
        :columns="columns"
        :data="companies"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
      />
    </n-card>

    <!-- 创建/编辑公司弹窗 -->
    <n-modal v-model:show="showCreateModal" preset="dialog" :title="isEdit ? '编辑公司' : '新建公司'">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" :label-width="80">
        <n-form-item label="公司名称" path="name">
          <n-input v-model:value="formData.name" placeholder="请输入公司名称" />
        </n-form-item>
        <n-form-item label="配额池" path="quota_pool">
          <n-input-number v-model:value="formData.quota_pool" :min="0" style="width: 100%;" />
        </n-form-item>
        <n-form-item label="每日配额" path="quota_daily">
          <n-input-number v-model:value="formData.quota_daily" :min="0" style="width: 100%;" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="closeModal">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="handleSubmit">确定</n-button>
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
  NSpace,
  NPopconfirm,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { getCompanies, createCompany, updateCompany, deleteCompany } from '@/shared/api/admin'
import { useMessage } from 'naive-ui'

const message = useMessage()
const loading = ref(false)
const companies = ref<any[]>([])
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const showCreateModal = ref(false)
const isEdit = ref(false)
const editId = ref('')
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

const formData = reactive({
  name: '',
  quota_pool: 0,
  quota_daily: 0,
})

const rules: FormRules = {
  name: { required: true, message: '请输入公司名称', trigger: 'blur' },
}

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 100 },
  { title: '公司名称', key: 'name', width: 200 },
  { title: '用户数', key: 'user_count', width: 100 },
  { title: '部门数', key: 'department_count', width: 100 },
  {
    title: '配额池',
    key: 'quota_pool',
    width: 150,
    render: (row) => `${(row.quota_used || 0).toLocaleString()} / ${(row.quota_pool || 0).toLocaleString()}`,
  },
  {
    title: '每日配额',
    key: 'quota_daily',
    width: 150,
    render: (row) => `${(row.daily_used || 0).toLocaleString()} / ${(row.quota_daily || 0).toLocaleString()}`,
  },
  { title: '创建时间', key: 'created_at', width: 180, render: (row) => formatDate(row.created_at) },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    fixed: 'right' as const,
    render: (row) => h(NSpace, {}, () => [
      h(NButton, { size: 'small', onClick: () => openEditModal(row) }, () => '编辑'),
      h(
        NPopconfirm,
        { onPositiveClick: () => handleDelete(row) },
        {
          trigger: () => h(NButton, { size: 'small', type: 'error' }, () => '删除'),
          default: () => '确定删除此公司？',
        }
      ),
    ]),
  },
]

async function loadCompanies() {
  loading.value = true
  try {
    const result = await getCompanies({ page: pagination.page, page_size: pagination.pageSize })
    companies.value = result.companies
    pagination.itemCount = result.total
  } catch (error: any) {
    message.error(error.message || '加载公司列表失败')
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  isEdit.value = false
  formData.name = ''
  formData.quota_pool = 0
  formData.quota_daily = 0
  showCreateModal.value = true
}

function openEditModal(row: any) {
  isEdit.value = true
  editId.value = row.id
  formData.name = row.name
  formData.quota_pool = row.quota_pool || 0
  formData.quota_daily = row.quota_daily || 0
  showCreateModal.value = true
}

function closeModal() {
  showCreateModal.value = false
  formData.name = ''
  formData.quota_pool = 0
  formData.quota_daily = 0
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    submitting.value = true

    if (isEdit.value) {
      await updateCompany(editId.value, {
        name: formData.name,
        quota_pool: formData.quota_pool,
        quota_daily: formData.quota_daily,
      })
      message.success('公司更新成功')
    } else {
      await createCompany({
        name: formData.name,
        quota_pool: formData.quota_pool,
        quota_daily: formData.quota_daily,
      })
      message.success('公司创建成功')
    }

    closeModal()
    await loadCompanies()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await deleteCompany(row.id)
    message.success('公司已删除')
    await loadCompanies()
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => loadCompanies())
</script>

<style scoped>
.companies-page {
  max-width: 1400px;
}
</style>

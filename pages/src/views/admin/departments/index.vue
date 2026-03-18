<template>
  <div class="departments-page">
    <n-card title="部门管理">
      <template #header-extra>
        <n-space>
          <n-select
            v-model:value="selectedCompany"
            :options="companyOptions"
            placeholder="选择公司"
            clearable
            style="width: 200px;"
            @update:value="handleCompanyChange"
          />
          <n-button type="primary" @click="openCreateModal">新建部门</n-button>
        </n-space>
      </template>
      <n-data-table
        :columns="columns"
        :data="departments"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
      />
    </n-card>

    <!-- 创建/编辑部门弹窗 -->
    <n-modal v-model:show="showModal" preset="dialog" :title="isEdit ? '编辑部门' : '新建部门'">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" :label-width="80">
        <n-form-item label="所属公司" path="company_id">
          <n-select
            v-model:value="formData.company_id"
            :options="companyOptions"
            placeholder="选择公司"
            filterable
            :disabled="isEdit"
          />
        </n-form-item>
        <n-form-item label="部门名称" path="name">
          <n-input v-model:value="formData.name" placeholder="请输入部门名称" />
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
import { ref, reactive, onMounted, h } from 'vue'
import {
  NCard,
  NSpace,
  NButton,
  NSelect,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NPopconfirm,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { getDepartments, getCompanies, createDepartment, updateDepartment, deleteDepartment } from '@/shared/api/admin'
import { useMessage } from 'naive-ui'

const message = useMessage()
const loading = ref(false)
const departments = ref<any[]>([])
const selectedCompany = ref<string>('')
const companyOptions = ref<{ label: string; value: string }[]>([])
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const showModal = ref(false)
const isEdit = ref(false)
const editId = ref('')
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

const formData = reactive({
  company_id: '',
  name: '',
  quota_pool: 0,
  quota_daily: 0,
})

const rules: FormRules = {
  company_id: { required: true, message: '请选择公司', trigger: 'change', type: 'string' },
  name: { required: true, message: '请输入部门名称', trigger: 'blur' },
}

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 100 },
  { title: '公司', key: 'company_name', width: 200 },
  { title: '部门名称', key: 'name', width: 200 },
  { title: '用户数', key: 'user_count', width: 100 },
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
          default: () => '确定删除此部门？',
        }
      ),
    ]),
  },
]

async function loadDepartments() {
  loading.value = true
  try {
    const result = await getDepartments({
      page: pagination.page,
      page_size: pagination.pageSize,
      company_id: selectedCompany.value || undefined,
    })
    departments.value = result.departments
    pagination.itemCount = result.total
  } catch (error: any) {
    message.error(error.message || '加载部门列表失败')
  } finally {
    loading.value = false
  }
}

async function loadCompanies() {
  try {
    const result = await getCompanies({ page: 1, page_size: 1000 })
    companyOptions.value = result.companies.map((c) => ({ label: c.name, value: c.id }))
  } catch (error: any) {
    message.error(error.message || '加载公司列表失败')
  }
}

function handleCompanyChange() {
  pagination.page = 1
  loadDepartments()
}

function openCreateModal() {
  isEdit.value = false
  formData.company_id = selectedCompany.value || ''
  formData.name = ''
  formData.quota_pool = 0
  formData.quota_daily = 0
  showModal.value = true
}

function openEditModal(row: any) {
  isEdit.value = true
  editId.value = row.id
  formData.company_id = row.company_id
  formData.name = row.name
  formData.quota_pool = row.quota_pool || 0
  formData.quota_daily = row.quota_daily || 0
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  formData.name = ''
  formData.quota_pool = 0
  formData.quota_daily = 0
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    submitting.value = true

    if (isEdit.value) {
      await updateDepartment(editId.value, {
        name: formData.name,
        quota_pool: formData.quota_pool,
        quota_daily: formData.quota_daily,
      })
      message.success('部门更新成功')
    } else {
      await createDepartment({
        company_id: formData.company_id,
        name: formData.name,
        quota_pool: formData.quota_pool,
        quota_daily: formData.quota_daily,
      })
      message.success('部门创建成功')
    }

    closeModal()
    await loadDepartments()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await deleteDepartment(row.id)
    message.success('部门已删除')
    await loadDepartments()
  } catch (error: any) {
    message.error(error.message || '删除失败')
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => {
  loadCompanies()
  loadDepartments()
})
</script>

<style scoped>
.departments-page {
  max-width: 1400px;
}
</style>

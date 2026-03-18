<template>
  <div class="users-page">
    <n-card title="用户管理">
      <template #header-extra>
        <n-space>
          <n-button type="primary" @click="showCreateModal = true">
            新建用户
          </n-button>
        </n-space>
      </template>

      <!-- 搜索筛选 -->
      <n-space vertical style="margin-bottom: 16px;">
        <n-space>
          <n-input
            v-model:value="searchText"
            placeholder="搜索用户名或邮箱"
            clearable
            style="width: 200px;"
          />
          <n-select
            v-model:value="roleFilter"
            :options="roleOptions"
            placeholder="选择角色"
            clearable
            style="width: 120px;"
          />
          <n-select
            v-model:value="statusFilter"
            :options="statusOptions"
            placeholder="选择状态"
            clearable
            style="width: 120px;"
          />
          <n-button @click="loadUsers">搜索</n-button>
        </n-space>
      </n-space>

      <!-- 用户列表 -->
      <n-data-table
        :columns="columns"
        :data="users"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
        @update:page="handlePageChange"
      />
    </n-card>

    <!-- 创建用户弹窗 -->
    <n-modal v-model:show="showCreateModal" preset="dialog" title="新建用户">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" :label-width="80">
        <n-form-item label="邮箱" path="email">
          <n-input v-model:value="formData.email" placeholder="user@example.com" />
        </n-form-item>
        <n-form-item label="姓名" path="name">
          <n-input v-model:value="formData.name" placeholder="用户姓名" />
        </n-form-item>
        <n-form-item label="角色" path="role">
          <n-radio-group v-model:value="formData.role">
            <n-radio value="user">普通用户</n-radio>
            <n-radio value="admin">管理员</n-radio>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="公司" path="company_id">
          <n-select
            v-model:value="formData.company_id"
            :options="companyOptions"
            placeholder="选择公司"
            filterable
          />
        </n-form-item>
        <n-form-item label="部门" path="department_id">
          <n-select
            v-model:value="formData.department_id"
            :options="departmentOptions"
            placeholder="选择部门（可选）"
            clearable
            filterable
          />
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, h, onMounted } from 'vue'
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
  NRadioGroup,
  NRadio,
  NTag,
  NSwitch,
  NPopconfirm,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { getUsers } from '@/shared/api/admin'
import { getCompanies } from '@/shared/api/admin'
import { getDepartments } from '@/shared/api/admin'

const loading = ref(false)
const users = ref<any[]>([])
const searchText = ref('')
const roleFilter = ref<'admin' | 'user' | null>(null)
const statusFilter = ref<'true' | 'false' | null>(null)

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
})

const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '普通用户', value: 'user' },
]

const statusOptions = [
  { label: '启用', value: 'true' as const },
  { label: '禁用', value: 'false' as const },
]

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 100 },
  { title: '邮箱', key: 'email', width: 200 },
  { title: '姓名', key: 'name', width: 150 },
  {
    title: '角色',
    key: 'role',
    width: 100,
    render: (row) =>
      h(
        NTag,
        { type: row.role === 'admin' ? 'error' : 'default', size: 'small' },
        { default: () => (row.role === 'admin' ? '管理员' : '普通用户') }
      ),
  },
  { title: '公司', key: 'company_name', width: 150 },
  { title: '部门', key: 'department_name', width: 150 },
  {
    title: '每日配额',
    key: 'quota_daily',
    width: 120,
    render: (row) => `${row.quota_daily.toLocaleString()} / ${row.quota_used.toLocaleString()}`,
  },
  {
    title: '状态',
    key: 'is_active',
    width: 100,
    render: (row) =>
      h(NSwitch, {
        value: row.is_active,
        disabled: row.role === 'admin',
        onUpdateValue: () => handleToggleStatus(row),
      }),
  },
  {
    title: 'API Keys',
    key: 'api_key_count',
    width: 100,
    render: (row) => row.api_key_count || 0,
  },
  { title: '创建时间', key: 'created_at', width: 180, render: (row) => formatDate(row.created_at) },
]

// 创建用户相关
const showCreateModal = ref(false)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)
const formData = reactive({
  email: '',
  name: '',
  role: 'user' as 'admin' | 'user',
  company_id: '',
  department_id: '',
  quota_daily: 100000,
})

const rules: FormRules = {
  email: { required: true, message: '请输入邮箱', trigger: 'blur' },
  name: { required: true, message: '请输入姓名', trigger: 'blur' },
  company_id: { required: true, message: '请选择公司', trigger: 'change', type: 'string' },
  quota_daily: { required: true, message: '请输入每日配额', trigger: 'blur', type: 'number' },
}

const companyOptions = ref<{ label: string; value: string }[]>([])
const departmentOptions = ref<{ label: string; value: string }[]>([])

async function loadUsers() {
  loading.value = true
  try {
    const result = await getUsers({
      page: pagination.page,
      page_size: pagination.pageSize,
    })
    users.value = result.users
    pagination.itemCount = result.total
  } catch (error) {
    console.error('Failed to load users:', error)
  } finally {
    loading.value = false
  }
}

async function loadCompanies() {
  try {
    const result = await getCompanies({ page: 1, page_size: 1000 })
    companyOptions.value = result.companies.map((c) => ({ label: c.name, value: c.id }))
  } catch (error) {
    console.error('Failed to load companies:', error)
  }
}

async function loadDepartments() {
  if (!formData.company_id) {
    departmentOptions.value = []
    return
  }
  try {
    const result = await getDepartments({ company_id: formData.company_id, page: 1, page_size: 1000 })
    departmentOptions.value = result.departments.map((d) => ({ label: d.name, value: d.id }))
  } catch (error) {
    console.error('Failed to load departments:', error)
  }
}

function handlePageChange(page: number) {
  pagination.page = page
  loadUsers()
}

function handleToggleStatus(row: any) {
  // TODO: 实现切换用户状态
  console.log('Toggle status for user:', row.id)
}

async function handleCreate() {
  try {
    await formRef.value?.validate()
    submitting.value = true
    // TODO: 调用创建用户 API
    console.log('Create user:', formData)
    showCreateModal.value = false
    await loadUsers()
  } catch (error) {
    console.error('Failed to create user:', error)
  } finally {
    submitting.value = false
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

onMounted(() => {
  loadUsers()
  loadCompanies()
})
</script>

<style scoped>
.users-page {
  max-width: 1400px;
}
</style>

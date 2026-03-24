<template>
  <div class="users-page">
    <n-card title="用户管理">
      <template #header-extra>
        <n-space>
          <n-button type="primary" @click="openCreateModal">
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
            @keyup.enter="handleSearch"
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
          <n-button @click="handleSearch">搜索</n-button>
        </n-space>
      </n-space>

      <!-- 用户列表 -->
      <n-data-table
        :columns="columns"
        :data="users"
        :loading="loading"
        :bordered="false"
        :pagination="false"
      />

      <!-- 分页 -->
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

    <!-- 创建/编辑用户弹窗 -->
    <n-modal v-model:show="showCreateModal" preset="dialog" :title="isEdit ? '编辑用户' : '新建用户'">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" :label-width="80">
        <n-form-item label="邮箱" path="email">
          <n-input v-model:value="formData.email" placeholder="user@example.com" :disabled="isEdit" />
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
          <n-button @click="closeModal">取消</n-button>
          <n-button type="primary" :loading="submitting" @click="handleSubmit">确定</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, h, onMounted, watch } from 'vue'
import {
  NCard,
  NSpace,
  NButton,
  NInput,
  NSelect,
  NDataTable,
  NPagination,
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
import { getUsers, createUser, updateUser, deleteUser } from '@/shared/api/admin'
import { getCompanies } from '@/shared/api/admin'
import { getDepartments } from '@/shared/api/admin'
import { useDialog, useMessage } from 'naive-ui'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const users = ref<any[]>([])

// 分页状态 - 使用 ref 而非 reactive
const currentPage = ref(1)
const pageSize = ref(10)
const totalItems = ref(0)

// 搜索筛选
const searchText = ref('')
const roleFilter = ref<'admin' | 'user' | null>(null)
const statusFilter = ref<'true' | 'false' | null>(null)

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
        defaultValue: Boolean(row.is_active),
        disabled: row.role === 'admin' || row.is_system,
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
  {
    title: '操作',
    key: 'actions',
    width: 150,
    fixed: 'right' as const,
    render: (row) => {
      if (row.is_system || row.role === 'admin') return null
      return h(NSpace, {}, () => [
        h(NButton, { size: 'small', onClick: () => openEditModal(row) }, () => '编辑'),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row) },
          {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => '删除'),
            default: () => '确定删除此用户？',
          }
        ),
      ])
    },
  },
]

// 创建/编辑用户相关
const showCreateModal = ref(false)
const isEdit = ref(false)
const editId = ref('')
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
  // PRD V2 第一期：company_id 改为可选，留待第二期使用
  quota_daily: { required: true, message: '请输入每日配额', trigger: 'blur', type: 'number' },
}

const companyOptions = ref<{ label: string; value: string }[]>([])
const departmentOptions = ref<{ label: string; value: string }[]>([])

async function loadUsers() {
  loading.value = true
  try {
    const result = await getUsers({
      page: currentPage.value,
      page_size: pageSize.value,
      search: searchText.value || undefined,
      role: roleFilter.value || undefined,
      is_active: statusFilter.value || undefined,
    })
    users.value = result.users
    totalItems.value = result.total
  } catch (error) {
    console.error('Failed to load users:', error)
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadUsers()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  loadUsers()
}

function handleSearch() {
  currentPage.value = 1
  loadUsers()
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

// 监听公司变化，自动加载部门列表
watch(() => formData.company_id, () => {
  formData.department_id = ''
  loadDepartments()
})

async function handleToggleStatus(row: any) {
  if (row.role === 'admin') return
  const currentStatus = Boolean(row.is_active)
  try {
    await updateUser(row.id, { is_active: !currentStatus })
    message.success(currentStatus ? '用户已禁用' : '用户已启用')
    loadUsers()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  }
}

function openCreateModal() {
  isEdit.value = false
  formData.email = ''
  formData.name = ''
  formData.role = 'user'
  formData.company_id = ''
  formData.department_id = ''
  formData.quota_daily = 100000
  showCreateModal.value = true
}

function openEditModal(row: any) {
  isEdit.value = true
  editId.value = row.id
  formData.email = row.email
  formData.name = row.name || ''
  formData.role = row.role
  formData.company_id = row.company_id
  formData.department_id = row.department_id || ''
  formData.quota_daily = row.quota_daily
  showCreateModal.value = true
}

function closeModal() {
  showCreateModal.value = false
  formData.email = ''
  formData.name = ''
  formData.role = 'user'
  formData.company_id = ''
  formData.department_id = ''
  formData.quota_daily = 100000
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
    submitting.value = true

    if (isEdit.value) {
      await updateUser(editId.value, {
        name: formData.name,
        role: formData.role,
        company_id: formData.company_id || undefined,
        department_id: formData.department_id || undefined,
        quota_daily: formData.quota_daily,
      })
      message.success('用户更新成功')
    } else {
      await createUser({
        email: formData.email,
        name: formData.name,
        role: formData.role,
        company_id: formData.company_id || undefined,
        department_id: formData.department_id || undefined,
        quota_daily: formData.quota_daily,
      })
      message.success('用户创建成功')
    }

    closeModal()
    await loadUsers()
  } catch (error: any) {
    message.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await deleteUser(row.id)
    message.success('用户已删除')
    // 如果当前页只有一条数据且不是第一页，则跳转到上一页
    if (users.value.length === 1 && currentPage.value > 1) {
      currentPage.value--
    }
    await loadUsers()
  } catch (error: any) {
    message.error(error.message || '删除失败')
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

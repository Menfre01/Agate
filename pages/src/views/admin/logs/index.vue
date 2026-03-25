<template>
  <div class="logs-page">
    <n-card title="日志查询">
      <template #header-extra>
        <n-space>
          <n-button @click="loadLogs">刷新</n-button>
          <n-button type="primary" @click="showFilters = !showFilters">
            {{ showFilters ? '隐藏' : '显示' }}筛选
          </n-button>
        </n-space>
      </template>

      <!-- 筛选条件 -->
      <n-collapse v-if="showFilters" style="margin-bottom: 16px;">
        <n-collapse-item title="筛选条件" name="filters">
          <n-grid :cols="4" :x-gap="12">
            <n-grid-item>
              <n-form-item label="用户名">
                <n-input v-model:value="filters.search" placeholder="搜索用户名或邮箱" clearable @keyup.enter="applyFilters" />
              </n-form-item>
            </n-grid-item>
            <n-grid-item>
              <n-form-item label="公司">
                <n-select
                  v-model:value="filters.company_id"
                  :options="companyOptions"
                  placeholder="选择公司"
                  clearable
                  filterable
                  @update:value="handleCompanyChange"
                />
              </n-form-item>
            </n-grid-item>
            <n-grid-item>
              <n-form-item label="部门">
                <n-select v-model:value="filters.department_id" :options="departmentOptions" placeholder="选择部门" clearable filterable />
              </n-form-item>
            </n-grid-item>
            <n-grid-item>
              <n-form-item label="模型">
                <n-select v-model:value="filters.model_id" :options="modelOptions" placeholder="选择模型" clearable filterable />
              </n-form-item>
            </n-grid-item>
            <n-grid-item>
              <n-form-item label="状态">
                <n-select v-model:value="filters.status" :options="statusOptions" placeholder="选择状态" clearable />
              </n-form-item>
            </n-grid-item>
            <n-grid-item>
              <n-form-item label="开始时间">
                <n-date-picker v-model:value="filters.start_at" type="datetime" clearable />
              </n-form-item>
            </n-grid-item>
            <n-grid-item>
              <n-form-item label="结束时间">
                <n-date-picker v-model:value="filters.end_at" type="datetime" clearable />
              </n-form-item>
            </n-grid-item>
            <n-grid-item>
              <n-form-item label=" ">
                <n-button type="primary" @click="applyFilters">应用筛选</n-button>
              </n-form-item>
            </n-grid-item>
          </n-grid>
        </n-collapse-item>
      </n-collapse>

      <!-- 日志列表 -->
      <n-data-table
        :columns="columns"
        :data="logs"
        :loading="loading"
        :pagination="false"
        :bordered="false"
        :scroll-x="1400"
      />
      <n-space justify="end" style="margin-top: 16px;">
        <n-pagination
          v-model:page="currentPage"
          v-model:page-size="pageSize"
          :item-count="totalItems"
          :page-sizes="[20, 50, 100, 200]"
          show-size-picker
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h, watch } from 'vue'
import {
  NCard,
  NSpace,
  NButton,
  NCollapse,
  NCollapseItem,
  NGrid,
  NGridItem,
  NFormItem,
  NInput,
  NSelect,
  NDatePicker,
  NDataTable,
  NPagination,
  NTag,
  type DataTableColumns,
} from 'naive-ui'
import { getLogs } from '@/shared/api/admin'
import { getModels } from '@/shared/api/admin'
import { getCompanies } from '@/shared/api/admin'
import { getDepartments } from '@/shared/api/admin'

const loading = ref(false)
const logs = ref<any[]>([])
const showFilters = ref(false)
const companyOptions = ref<{ label: string; value: string }[]>([])
const departmentOptions = ref<{ label: string; value: string }[]>([])
const modelOptions = ref<{ label: string; value: string }[]>([])

// 分页状态
const currentPage = ref(1)
const pageSize = ref(50)
const totalItems = ref(0)

const filters = reactive({
  search: '',
  company_id: '',
  department_id: '',
  model_id: '',
  status: '' as 'success' | 'error' | '',
  start_at: null as number | null,
  end_at: null as number | null,
})

const statusOptions = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'error' },
]

const columns: DataTableColumns<any> = [
  { title: '时间', key: 'created_at', width: 180, render: (row) => formatDate(row.created_at), fixed: 'left' },
  { title: '用户', key: 'user_email', width: 180, ellipsis: { tooltip: true } },
  { title: '公司', key: 'company_name', width: 150, ellipsis: { tooltip: true } },
  { title: '部门', key: 'department_name', width: 120, ellipsis: { tooltip: true } },
  { title: '提供商', key: 'provider_name', width: 100 },
  { title: '模型', key: 'model_name', width: 150 },
  { title: '端点', key: 'endpoint', width: 120, ellipsis: { tooltip: true } },
  {
    title: 'Token',
    key: 'tokens',
    width: 120,
    render: (row) => `${row.total_tokens.toLocaleString()} (${row.input_tokens.toLocaleString()}+${row.output_tokens.toLocaleString()})`,
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
    render: (row) => h(NTag, { type: row.status === 'success' ? 'success' : 'error', size: 'small' }, () => row.status === 'success' ? '成功' : '失败'),
  },
  { title: '错误', key: 'error_code', width: 100, ellipsis: { tooltip: true } },
  { title: '耗时', key: 'response_time_ms', width: 80, render: (row) => row.response_time_ms ? `${row.response_time_ms}ms` : '-' },
  { title: '请求 ID', key: 'request_id', width: 200, ellipsis: { tooltip: true } },
]

async function loadLogs() {
  loading.value = true
  try {
    const query: any = {
      page: currentPage.value,
      page_size: pageSize.value,
    }
    if (filters.search) query.search = filters.search
    if (filters.company_id) query.company_id = filters.company_id
    if (filters.department_id) query.department_id = filters.department_id
    if (filters.model_id) query.model_id = filters.model_id
    if (filters.status) query.status = filters.status
    if (filters.start_at) query.start_at = filters.start_at
    if (filters.end_at) query.end_at = filters.end_at

    const result = await getLogs(query)
    logs.value = result.logs
    totalItems.value = result.total
  } catch (error) {
    console.error('Failed to load logs:', error)
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadLogs()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  loadLogs()
}

async function applyFilters() {
  currentPage.value = 1
  await loadLogs()
}

function handleCompanyChange() {
  filters.department_id = ''
  loadDepartments()
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

async function loadOptions() {
  try {
    const [companiesResult, modelsResult] = await Promise.all([
      getCompanies({ page: 1, page_size: 1000 }),
      getModels({ page: 1, page_size: 1000 }),
    ])
    companyOptions.value = companiesResult.companies.map((c) => ({ label: c.name, value: c.id }))
    modelOptions.value = modelsResult.models.map((m) => ({ label: m.display_name, value: m.id }))
  } catch (error) {
    console.error('Failed to load options:', error)
  }
}

async function loadDepartments() {
  if (!filters.company_id) {
    departmentOptions.value = []
    return
  }
  try {
    const result = await getDepartments({ company_id: filters.company_id, page: 1, page_size: 1000 })
    departmentOptions.value = result.departments.map((d) => ({ label: d.name, value: d.id }))
  } catch (error) {
    console.error('Failed to load departments:', error)
  }
}

// 监听公司变化，加载对应部门
watch(() => filters.company_id, () => {
  filters.department_id = ''
  loadDepartments()
})

onMounted(() => {
  loadLogs()
  loadOptions()
})
</script>

<style scoped>
.logs-page {
  max-width: 1600px;
}
</style>

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
            @update:value="loadDepartments"
          />
          <n-button type="primary">新建部门</n-button>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { NCard, NSpace, NButton, NSelect, NDataTable, type DataTableColumns } from 'naive-ui'
import { getDepartments, getCompanies } from '@/shared/api/admin'

const loading = ref(false)
const departments = ref<any[]>([])
const selectedCompany = ref<string>('')
const companyOptions = ref<{ label: string; value: string }[]>([])
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 100 },
  { title: '公司', key: 'company_name', width: 200 },
  { title: '部门名称', key: 'name', width: 200 },
  { title: '用户数', key: 'user_count', width: 100 },
  {
    title: '配额池',
    key: 'quota_pool',
    width: 150,
    render: (row) => `${row.quota_used.toLocaleString()} / ${row.quota_pool.toLocaleString()}`,
  },
  {
    title: '每日配额',
    key: 'quota_daily',
    width: 150,
    render: (row) => `${row.daily_used.toLocaleString()} / ${row.quota_daily.toLocaleString()}`,
  },
  { title: '创建时间', key: 'created_at', width: 180, render: (row) => formatDate(row.created_at) },
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
  } catch (error) {
    console.error('Failed to load departments:', error)
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

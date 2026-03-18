<template>
  <div class="companies-page">
    <n-card title="公司管理">
      <template #header-extra>
        <n-button type="primary">新建公司</n-button>
      </template>
      <n-data-table
        :columns="columns"
        :data="companies"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { NCard, NButton, NDataTable, NTag, type DataTableColumns } from 'naive-ui'
import { getCompanies } from '@/shared/api/admin'

const loading = ref(false)
const companies = ref<any[]>([])
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const columns: DataTableColumns<any> = [
  { title: 'ID', key: 'id', width: 100 },
  { title: '公司名称', key: 'name', width: 200 },
  { title: '用户数', key: 'user_count', width: 100 },
  { title: '部门数', key: 'department_count', width: 100 },
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

async function loadCompanies() {
  loading.value = true
  try {
    const result = await getCompanies({ page: pagination.page, page_size: pagination.pageSize })
    companies.value = result.companies
    pagination.itemCount = result.total
  } catch (error) {
    console.error('Failed to load companies:', error)
  } finally {
    loading.value = false
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

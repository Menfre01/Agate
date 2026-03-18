<template>
  <div class="dashboard-page">
    <n-space vertical size="large">
      <!-- 时间范围选择 -->
      <n-card>
        <n-space>
          <n-radio-group v-model:value="period" @update:value="loadData">
            <n-radio-button value="day">近 24 小时</n-radio-button>
            <n-radio-button value="week">近 7 天</n-radio-button>
            <n-radio-button value="month">近 30 天</n-radio-button>
          </n-radio-group>
        </n-space>
      </n-card>

      <!-- 全局统计概览 -->
      <n-grid :cols="5" :x-gap="16">
        <n-grid-item>
          <n-card>
            <n-statistic label="总请求数" :value="usageStats.total_requests || 0" />
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="成功率" :value="successRate" suffix="%">
              <template #prefix>
                <n-icon :component="CheckCircleOutlined" :color="Number(successRate) >= 95 ? '#18a058' : '#e6a23c'" />
              </template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="总 Token 数" :value="usageStats.total_tokens || 0">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="输入 Token" :value="usageStats.input_tokens || 0">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="输出 Token" :value="usageStats.total_output_tokens || 0">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
      </n-grid>

      <!-- Token 使用趋势图 -->
      <n-card title="Token 使用趋势">
        <div ref="trendChartRef" class="chart-container"></div>
      </n-card>

      <!-- 成本分析 -->
      <n-card title="成本分析">
        <div ref="costChartRef" class="chart-container"></div>
      </n-card>

      <!-- 模型使用排行 -->
      <n-card title="模型使用排行">
        <n-data-table
          :columns="modelColumns"
          :data="modelStats"
          :pagination="{ pageSize: 10 }"
          :bordered="false"
        />
      </n-card>

      <!-- 用户用量排行 -->
      <n-card title="用户用量排行 (Top 10)">
        <n-data-table
          :columns="userColumns"
          :data="userRanking"
          :pagination="false"
          :bordered="false"
        />
      </n-card>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import {
  NSpace,
  NCard,
  NGrid,
  NGridItem,
  NStatistic,
  NRadioGroup,
  NRadioButton,
  NIcon,
  NDataTable,
  type DataTableColumns,
} from 'naive-ui'
import { CheckCircleOutlined } from '@vicons/antd'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { getUsageStats, getModelStats } from '@/shared/api'
import type { UsageStatsResponse, ModelStatsResponse } from '@shared/types/api'

const period = ref<'day' | 'week' | 'month'>('week')
const usageStats = ref<UsageStatsResponse>({
  total_requests: 0,
  successful_requests: 0,
  failed_requests: 0,
  input_tokens: 0,
  total_output_tokens: 0,
  total_tokens: 0,
  estimated_cost: 0,
  grouped: [],
})
const modelStats = ref<ModelStatsResponse[]>([])

const trendChartRef = ref<HTMLElement>()
const costChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let costChart: echarts.ECharts | null = null

const successRate = computed(() => {
  if (usageStats.value.total_requests === 0) return 0
  return ((usageStats.value.successful_requests / usageStats.value.total_requests) * 100).toFixed(2)
})

const userRanking = computed(() => {
  return usageStats.value.grouped
    .filter((g) => g.key && !g.key.startsWith('model-'))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10)
})

const modelColumns: DataTableColumns<ModelStatsResponse> = [
  { title: '模型', key: 'model_name' },
  {
    title: '请求数',
    key: 'request_count',
    render: (row) => row.request_count.toLocaleString(),
  },
  {
    title: '总 Token',
    key: 'total_tokens',
    render: (row) => row.total_tokens.toLocaleString(),
  },
  {
    title: '平均 Token/请求',
    key: 'avg_tokens_per_request',
    render: (row) => Math.round(row.avg_tokens_per_request).toLocaleString(),
  },
  {
    title: '成功率',
    key: 'success_rate',
    render: (row) => `${(row.success_rate * 100).toFixed(2)}%`,
  },
]

const userColumns: DataTableColumns<{ key: string; requests: number; tokens: number; cost: number }> = [
  { title: '排名', key: 'rank', render: (_, index) => index + 1 },
  { title: '用户', key: 'key' },
  {
    title: '请求数',
    key: 'requests',
    render: (row) => row.requests.toLocaleString(),
  },
  {
    title: 'Token 数',
    key: 'tokens',
    render: (row) => row.tokens.toLocaleString(),
  },
  {
    title: '成本',
    key: 'cost',
    render: (row) => `$${row.cost.toFixed(4)}`,
  },
]

async function loadData() {
  try {
    const now = Date.now()
    let startAt = now - 86400000
    if (period.value === 'week') startAt = now - 86400000 * 7
    if (period.value === 'month') startAt = now - 86400000 * 30

    const [usage, models] = await Promise.all([
      getUsageStats({ start_at: startAt, end_at: now, group_by: 'day' }),
      getModelStats({ start_at: startAt, end_at: now }),
    ])

    usageStats.value = usage
    modelStats.value = models.stats

    await nextTick()
    renderTrendChart()
    renderCostChart()
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
}

function renderTrendChart() {
  if (!trendChartRef.value) return

  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  // 按日期分组的数据
  const dayData = usageStats.value.grouped.filter((g) => g.key.match(/^\d{4}-\d{2}-\d{2}$/))

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['请求数', 'Token 数'],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dayData.map((d) => d.key),
    },
    yAxis: [
      {
        type: 'value',
        name: '请求数',
        position: 'left',
      },
      {
        type: 'value',
        name: 'Token 数',
        position: 'right',
      },
    ],
    series: [
      {
        name: '请求数',
        type: 'bar',
        yAxisIndex: 0,
        data: dayData.map((d) => d.requests),
        itemStyle: { color: '#18a058' },
      },
      {
        name: 'Token 数',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: dayData.map((d) => d.tokens),
        areaStyle: { opacity: 0.3 },
      },
    ],
  }

  trendChart.setOption(option)
}

function renderCostChart() {
  if (!costChartRef.value) return

  if (!costChart) {
    costChart = echarts.init(costChartRef.value)
  }

  // 按模型分组的成本数据
  const modelCosts = usageStats.value.grouped.filter((g) => g.key.startsWith('model-'))

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ${c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '成本',
        type: 'pie',
        radius: ['40%', '70%'],
        data: modelCosts.map((m) => ({
          name: m.key.replace('model-', ''),
          value: m.cost,
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  }

  costChart.setOption(option)
}

onMounted(() => {
  loadData()

  window.addEventListener('resize', () => {
    trendChart?.resize()
    costChart?.resize()
  })
})
</script>

<style scoped>
.dashboard-page {
  max-width: 1400px;
}

.chart-container {
  width: 100%;
  height: 400px;
}
</style>

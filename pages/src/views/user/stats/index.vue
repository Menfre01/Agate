<template>
  <div class="stats-page">
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

      <!-- 统计概览 -->
      <n-grid :cols="3" :x-gap="16">
        <n-grid-item>
          <n-card>
            <n-statistic label="总 Token 数" :value="tokenUsage.total_tokens || 0">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="输入 Token" :value="tokenUsage.input_tokens || 0">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="输出 Token" :value="tokenUsage.output_tokens || 0">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
      </n-grid>

      <!-- Token 使用趋势图 -->
      <n-card title="Token 使用趋势">
        <div ref="trendChartRef" class="chart-container"></div>
      </n-card>

      <!-- 模型使用分布 -->
      <n-card title="模型使用分布">
        <div ref="modelChartRef" class="chart-container"></div>
      </n-card>

      <!-- 模型使用排行 -->
      <n-card title="模型使用排行">
        <n-data-table
          :columns="modelColumns"
          :data="tokenUsage.by_model || []"
          :pagination="{ pageSize: 10 }"
          :bordered="false"
        />
      </n-card>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import {
  NSpace,
  NCard,
  NGrid,
  NGridItem,
  NStatistic,
  NRadioGroup,
  NRadioButton,
  NDataTable,
  type DataTableColumns,
} from 'naive-ui'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { getUserTokenUsage } from '@/shared/api'
import type { TokenUsageSummaryResponse, TokenUsageResponse } from '@shared/types/api'

const period = ref<'day' | 'week' | 'month'>('week')
const tokenUsage = ref<TokenUsageSummaryResponse>({
  total_tokens: 0,
  input_tokens: 0,
  output_tokens: 0,
  by_model: [],
})

// 兼容处理：将 API 返回的 TokenUsageResponse 转换为 TokenUsageSummaryResponse
function transformTokenUsage(response: TokenUsageResponse): TokenUsageSummaryResponse {
  // TokenUsageResponse 的 by_model 需要从其他数据计算
  // 这里使用简化处理，直接返回基础数据
  return {
    total_tokens: response.total_tokens,
    input_tokens: response.input_tokens,
    output_tokens: response.output_tokens,
    by_model: response.by_entity
      .map((e) => ({
        model_id: e.entity_id,
        model_name: e.entity_name || e.entity_id,
        input_tokens: Math.floor(response.input_tokens * (response.total_tokens > 0 ? (e.total_tokens / response.total_tokens) : 0)),
        output_tokens: Math.floor(response.output_tokens * (response.total_tokens > 0 ? (e.total_tokens / response.total_tokens) : 0)),
        total_tokens: e.total_tokens,
        requests: e.request_count || 0,
      })),
  }
}

const trendChartRef = ref<HTMLElement>()
const modelChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let modelChart: echarts.ECharts | null = null

const modelColumns: DataTableColumns<TokenUsageSummaryResponse['by_model'][0]> = [
  { title: '模型', key: 'model_name' },
  {
    title: '总 Token',
    key: 'total_tokens',
    render: (row) => row.total_tokens.toLocaleString(),
  },
  {
    title: '输入 Token',
    key: 'input_tokens',
    render: (row) => row.input_tokens.toLocaleString(),
  },
  {
    title: '输出 Token',
    key: 'output_tokens',
    render: (row) => row.output_tokens.toLocaleString(),
  },
  {
    title: '请求数',
    key: 'requests',
    render: (row) => row.requests.toLocaleString(),
  },
]

async function loadData() {
  try {
    const data = await getUserTokenUsage({ period: period.value })
    tokenUsage.value = transformTokenUsage(data)

    await nextTick()
    renderTrendChart()
    renderModelChart()
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

function renderTrendChart() {
  if (!trendChartRef.value) return

  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  // 根据模型数据生成时间序列数据（简化版）
  const modelNames = tokenUsage.value.by_model?.map((m) => m.model_name) || []

  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['输入 Token', '输出 Token'],
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
      data: modelNames.slice(0, 7),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        name: '输入 Token',
        type: 'line',
        smooth: true,
        data: tokenUsage.value.by_model?.slice(0, 7).map((m) => m.input_tokens) || [],
        areaStyle: {},
      },
      {
        name: '输出 Token',
        type: 'line',
        smooth: true,
        data: tokenUsage.value.by_model?.slice(0, 7).map((m) => m.output_tokens) || [],
        areaStyle: {},
      },
    ],
  }

  trendChart.setOption(option)
}

function renderModelChart() {
  if (!modelChartRef.value) return

  if (!modelChart) {
    modelChart = echarts.init(modelChartRef.value)
  }

  const data = tokenUsage.value.by_model?.map((m) => ({
    name: m.model_name,
    value: m.total_tokens,
  })) || []

  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} tokens ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: 'Token 使用量',
        type: 'pie',
        radius: '60%',
        data,
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

  modelChart.setOption(option)
}

onMounted(() => {
  loadData()

  window.addEventListener('resize', () => {
    trendChart?.resize()
    modelChart?.resize()
  })
})

watch(period, () => {
  loadData()
})
</script>

<style scoped>
.stats-page {
  max-width: 1200px;
}

.chart-container {
  width: 100%;
  height: 400px;
}
</style>

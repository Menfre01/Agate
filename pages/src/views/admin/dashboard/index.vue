<template>
  <div class="dashboard-page">
    <n-space vertical size="large">
      <!-- 时间范围选择 -->
      <n-card>
        <n-space>
          <n-radio-group v-model:value="period" @update:value="handlePeriodChange">
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
            <n-statistic label="总请求数" :value="usageData.total_requests || 0" />
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="成功率" :value="successRate" suffix="%">
              <template #prefix>
                <span :style="{ color: Number(successRate) >= 95 ? '#18a058' : '#e6a23c' }">✓</span>
              </template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="总 Token 数" :value="formatTokens(usageData.total_tokens || 0)">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="输入 Token" :value="formatTokens(usageData.input_tokens || 0)">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="输出 Token" :value="formatTokens(usageData.total_output_tokens || 0)">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
      </n-grid>

      <!-- Token 使用趋势图 -->
      <n-card title="Token 使用趋势">
        <n-spin :show="loading">
          <div ref="trendChartEl" class="chart-container"></div>
        </n-spin>
      </n-card>

      <!-- 成本分析 -->
      <n-card title="成本分析">
        <n-spin :show="loading">
          <div ref="costChartEl" class="chart-container"></div>
        </n-spin>
      </n-card>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  NSpace,
  NCard,
  NGrid,
  NGridItem,
  NStatistic,
  NRadioGroup,
  NRadioButton,
  NSpin,
} from 'naive-ui'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { getUsageStats, getProviderModelStats } from '@/shared/api'
import type { UsageStatsResponse, ProviderModelStatsResponse } from '@shared/types'

const period = ref<'day' | 'week' | 'month'>('week')
const loading = ref(false)

const usageData = ref<UsageStatsResponse>({
  total_requests: 0,
  successful_requests: 0,
  failed_requests: 0,
  input_tokens: 0,
  total_output_tokens: 0,
  total_tokens: 0,
  estimated_cost: 0,
  grouped: [],
})

const modelData = ref<ProviderModelStatsResponse[]>([])

const successRate = computed(() => {
  if (usageData.value.total_requests === 0) return 0
  return ((usageData.value.successful_requests / usageData.value.total_requests) * 100).toFixed(2)
})

// 格式化 token 数值，超过 1000 使用 k 单位
function formatTokens(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return value.toString()
}

// 图表 ref
const trendChartEl = ref<HTMLElement | null>(null)
const costChartEl = ref<HTMLElement | null>(null)

// 图表实例
let trendChart: echarts.ECharts | null = null
let costChart: echarts.ECharts | null = null

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const now = Date.now()
    let startAt = now - 86400000
    if (period.value === 'week') startAt = now - 86400000 * 7
    if (period.value === 'month') startAt = now - 86400000 * 30

    const [usage, models] = await Promise.all([
      getUsageStats({ start_at: startAt, end_at: now, group_by: 'day' }),
      getProviderModelStats({ start_at: startAt, end_at: now }),
    ])

    usageData.value = usage
    modelData.value = models.stats

    // 等待 DOM 更新后渲染图表
    setTimeout(() => {
      renderCharts()
    }, 100)
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  } finally {
    loading.value = false
  }
}

// 渲染图表
function renderCharts() {
  renderTrendChart()
  renderCostChart()
}

function renderTrendChart() {
  if (!trendChartEl.value) return

  if (trendChartEl.value.clientWidth === 0 || trendChartEl.value.clientHeight === 0) {
    return
  }

  try {
    if (!trendChart) {
      trendChart = echarts.init(trendChartEl.value)
    }

    // 按日期分组的数据
    const dayData = usageData.value.grouped.filter((g) => g.key.match(/^\d{4}-\d{2}-\d{2}$/))

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
  } catch (error) {
    console.error('Failed to render trend chart:', error)
  }
}

function renderCostChart() {
  if (!costChartEl.value) return

  if (costChartEl.value.clientWidth === 0 || costChartEl.value.clientHeight === 0) {
    return
  }

  try {
    if (!costChart) {
      costChart = echarts.init(costChartEl.value)
    }

    // 使用 provider-model 统计数据，按 token 数量分配
    const modelCosts = modelData.value.map((m) => ({
      name: `${m.provider_name} - ${m.model_name}`,
      value: m.total_tokens,
    }))

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
          name: 'Token 使用',
          type: 'pie',
          radius: ['40%', '70%'],
          data: modelCosts,
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
  } catch (error) {
    console.error('Failed to render cost chart:', error)
  }
}

async function handlePeriodChange() {
  await loadData()
}

onMounted(() => {
  loadData()

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  costChart?.dispose()
  trendChart = null
  costChart = null
})

function handleResize() {
  trendChart?.resize()
  costChart?.resize()
}
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

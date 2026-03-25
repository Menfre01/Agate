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

      <!-- Token 分布 -->
      <n-grid :cols="3" :x-gap="16">
        <n-grid-item>
          <n-card title="总 Token 分布">
            <n-spin :show="loading">
              <div ref="totalChartEl" class="chart-container-small"></div>
            </n-spin>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card title="输入 Token 分布">
            <n-spin :show="loading">
              <div ref="inputChartEl" class="chart-container-small"></div>
            </n-spin>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card title="输出 Token 分布">
            <n-spin :show="loading">
              <div ref="outputChartEl" class="chart-container-small"></div>
            </n-spin>
          </n-card>
        </n-grid-item>
      </n-grid>
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
const totalChartEl = ref<HTMLElement | null>(null)
const inputChartEl = ref<HTMLElement | null>(null)
const outputChartEl = ref<HTMLElement | null>(null)

// 图表实例
let trendChart: echarts.ECharts | null = null
let totalChart: echarts.ECharts | null = null
let inputChart: echarts.ECharts | null = null
let outputChart: echarts.ECharts | null = null

// 根据时间范围获取分组方式
function getGroupBy(): 'hour' | 'day' | 'week' {
  if (period.value === 'day') return 'hour'
  if (period.value === 'week') return 'day'
  return 'week'
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const now = Date.now()
    let startAt = now - 86400000
    if (period.value === 'week') startAt = now - 86400000 * 7
    if (period.value === 'month') startAt = now - 86400000 * 30

    const [usage, models] = await Promise.all([
      getUsageStats({ start_at: startAt, end_at: now, group_by: getGroupBy() }),
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
  renderTotalChart()
  renderInputChart()
  renderOutputChart()
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

    // 使用所有分组数据
    const data = usageData.value.grouped

    const option: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let result = `${params[0].axisValue}<br/>`
          params.forEach((p: any) => {
            result += `${p.marker} ${p.seriesName}: ${formatTokens(p.value)}<br/>`
          })
          return result
        },
      },
      legend: {
        data: ['总 Token', '输入 Token', '输出 Token'],
        orient: 'vertical',
        right: 10,
        top: 'center',
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
        data: data.map((d) => d.key),
      },
      yAxis: {
        type: 'value',
        name: 'Token 数',
      },
      series: [
        {
          name: '总 Token',
          type: 'line',
          smooth: true,
          data: data.map((d) => d.tokens),
          itemStyle: { color: '#2080f0' },
          lineStyle: { color: '#2080f0' },
        },
        {
          name: '输入 Token',
          type: 'line',
          smooth: true,
          data: data.map((d) => d.input_tokens),
          itemStyle: { color: '#18a058' },
          lineStyle: { color: '#18a058' },
        },
        {
          name: '输出 Token',
          type: 'line',
          smooth: true,
          data: data.map((d) => d.output_tokens),
          itemStyle: { color: '#e6a23c' },
          lineStyle: { color: '#e6a23c' },
        },
      ],
    }

    trendChart.setOption(option)
  } catch (error) {
    console.error('Failed to render trend chart:', error)
  }
}

function renderTotalChart() {
  if (!totalChartEl.value) return
  if (totalChartEl.value.clientWidth === 0 || totalChartEl.value.clientHeight === 0) return

  try {
    if (!totalChart) {
      totalChart = echarts.init(totalChartEl.value)
    }

    const data = modelData.value.map((m) => ({
      name: `${m.provider_name} - ${m.model_name}`,
      value: m.total_tokens,
    }))

    const option: EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}: ${formatTokens(params.value)} (${params.percent}%)`,
      },
      series: [{
        type: 'pie',
        radius: '70%',
        data,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      }],
    }

    totalChart.setOption(option)
  } catch (error) {
    console.error('Failed to render total chart:', error)
  }
}

function renderInputChart() {
  if (!inputChartEl.value) return
  if (inputChartEl.value.clientWidth === 0 || inputChartEl.value.clientHeight === 0) return

  try {
    if (!inputChart) {
      inputChart = echarts.init(inputChartEl.value)
    }

    const data = modelData.value.map((m) => ({
      name: `${m.provider_name} - ${m.model_name}`,
      value: m.input_tokens,
    }))

    const option: EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}: ${formatTokens(params.value)} (${params.percent}%)`,
      },
      series: [{
        type: 'pie',
        radius: '70%',
        data,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      }],
    }

    inputChart.setOption(option)
  } catch (error) {
    console.error('Failed to render input chart:', error)
  }
}

function renderOutputChart() {
  if (!outputChartEl.value) return
  if (outputChartEl.value.clientWidth === 0 || outputChartEl.value.clientHeight === 0) return

  try {
    if (!outputChart) {
      outputChart = echarts.init(outputChartEl.value)
    }

    const data = modelData.value.map((m) => ({
      name: `${m.provider_name} - ${m.model_name}`,
      value: m.output_tokens,
    }))

    const option: EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}: ${formatTokens(params.value)} (${params.percent}%)`,
      },
      series: [{
        type: 'pie',
        radius: '70%',
        data,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      }],
    }

    outputChart.setOption(option)
  } catch (error) {
    console.error('Failed to render output chart:', error)
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
  totalChart?.dispose()
  inputChart?.dispose()
  outputChart?.dispose()
  trendChart = null
  totalChart = null
  inputChart = null
  outputChart = null
})

function handleResize() {
  trendChart?.resize()
  totalChart?.resize()
  inputChart?.resize()
  outputChart?.resize()
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

.chart-container-small {
  width: 100%;
  height: 300px;
}
</style>

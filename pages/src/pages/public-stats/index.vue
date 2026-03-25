<template>
  <div class="public-stats-page">
    <!-- API Key 输入区域 -->
    <n-card v-if="!apiKey && !userInfo" class="api-key-card">
      <div class="api-key-input">
        <h2>查看用量统计</h2>
        <p>请输入您的 API Key 查看使用情况</p>
        <n-input
          v-model:value="inputApiKey"
          type="password"
          show-password-on="click"
          placeholder="请输入 API Key (sk_...)"
          :disabled="loading"
          @keyup.enter="loadUserData"
        />
        <n-button type="primary" :loading="loading" @click="loadUserData" block>
          查看统计
        </n-button>
      </div>
    </n-card>

    <!-- 错误提示 -->
    <n-alert v-if="error" type="error" title="加载失败" closable @close="error = ''">
      {{ error }}
    </n-alert>

    <!-- 用户统计内容 -->
    <template v-if="userInfo">
      <!-- 用户信息头部 -->
      <n-card class="user-info-card">
        <n-space align="center" justify="space-between">
          <n-space vertical size="small">
            <n-space align="center">
              <n-avatar round size="large" type="info">
                {{ userInfo.userName ? userInfo.userName.charAt(0).toUpperCase() : '?' }}
              </n-avatar>
              <div>
                <h3>{{ userInfo.userName || userInfo.userEmail }}</h3>
                <n-text depth="3">{{ userInfo.userEmail }}</n-text>
              </div>
            </n-space>
            <n-space v-if="userInfo.companyName || userInfo.departmentName">
              <n-tag v-if="userInfo.companyName" type="info">{{ userInfo.companyName }}</n-tag>
              <n-tag v-if="userInfo.departmentName" type="success">{{ userInfo.departmentName }}</n-tag>
            </n-space>
          </n-space>
          <n-button text @click="clearApiKey">
            清除并重新输入
          </n-button>
        </n-space>
      </n-card>

      <!-- 配额信息 -->
      <n-grid :cols="4" :x-gap="16" class="quota-grid">
        <n-grid-item>
          <n-card>
            <n-statistic label="每日配额" :value="userInfo.quotaDaily">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="已使用" :value="userInfo.quotaUsed">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="剩余配额" :value="remainingQuota">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="使用率" :value="quotaPercentage" suffix="%">
              <template #prefix>
                <span :style="{ color: quotaPercentage > 80 ? '#e6a23c' : '#18a058' }">
                  {{ quotaPercentage > 80 ? '⚠' : '✓' }}
                </span>
              </template>
            </n-statistic>
          </n-card>
        </n-grid-item>
      </n-grid>

      <!-- 时间范围选择 -->
      <n-card>
        <n-space>
          <n-radio-group v-model:value="period" @update:value="loadTokenUsage">
            <n-radio-button value="day">近 24 小时</n-radio-button>
            <n-radio-button value="week">近 7 天</n-radio-button>
            <n-radio-button value="month">近 30 天</n-radio-button>
          </n-radio-group>
          <n-divider vertical />
          <n-space align="center">
            <n-text depth="3">自动刷新:</n-text>
            <n-select
              v-model:value="autoRefreshInterval"
              :options="refreshOptions"
              style="width: 120px"
              @update:value="onRefreshIntervalChange"
            />
          </n-space>
        </n-space>
      </n-card>

      <!-- Token 统计 -->
      <n-grid :cols="3" :x-gap="16">
        <n-grid-item>
          <n-card>
            <n-statistic label="总 Token 数" :value="formatTokens(tokenUsage.total_tokens || 0)">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="输入 Token" :value="formatTokens(tokenUsage.input_tokens || 0)">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card>
            <n-statistic label="输出 Token" :value="formatTokens(tokenUsage.output_tokens || 0)">
              <template #suffix>tokens</template>
            </n-statistic>
          </n-card>
        </n-grid-item>
      </n-grid>

      <!-- Token 使用趋势图 -->
      <n-card title="Token 使用趋势">
        <div ref="trendChartRef" class="chart-container"></div>
      </n-card>

      <!-- Token 分布 -->
      <n-grid :cols="3" :x-gap="16">
        <n-grid-item>
          <n-card title="总 Token 分布">
            <div ref="totalChartRef" class="chart-container-small"></div>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card title="输入 Token 分布">
            <div ref="inputChartRef" class="chart-container-small"></div>
          </n-card>
        </n-grid-item>
        <n-grid-item>
          <n-card title="输出 Token 分布">
            <div ref="outputChartRef" class="chart-container-small"></div>
          </n-card>
        </n-grid-item>
      </n-grid>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCard,
  NSpace,
  NGrid,
  NGridItem,
  NStatistic,
  NRadioGroup,
  NRadioButton,
  NButton,
  NInput,
  NAvatar,
  NTag,
  NText,
  NAlert,
  NSelect,
  NDivider,
  type FormInst,
} from 'naive-ui'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { AuthContext } from '@shared/types'
import type { TokenUsageResponse } from '@shared/types'
import axios from 'axios'

const route = useRoute()

// 状态
const inputApiKey = ref('')
const apiKey = ref('')
const userInfo = ref<AuthContext | null>(null)
const tokenUsage = ref<TokenUsageResponse>({
  period: 'week',
  start_at: Date.now() - 86400000 * 7,
  end_at: Date.now(),
  total_tokens: 0,
  input_tokens: 0,
  output_tokens: 0,
  by_entity: [],
})

// Token 趋势数据
interface TokenTrendData {
  key: string
  input_tokens: number
  output_tokens: number
  tokens: number
}
const tokenTrend = ref<TokenTrendData[]>([])
const loading = ref(false)
const error = ref('')
const period = ref<'day' | 'week' | 'month'>('week')

// 自动刷新
type RefreshInterval = 'off' | '30s' | '1m' | '5m'
const autoRefreshInterval = ref<RefreshInterval>('off')
const timerRef = ref<number | null>(null)

const refreshOptions = [
  { label: '关闭', value: 'off' },
  { label: '30 秒', value: '30s' },
  { label: '1 分钟', value: '1m' },
  { label: '5 分钟', value: '5m' },
]

// 图表引用
const trendChartRef = ref<HTMLElement>()
const totalChartRef = ref<HTMLElement>()
const inputChartRef = ref<HTMLElement>()
const outputChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let totalChart: echarts.ECharts | null = null
let inputChart: echarts.ECharts | null = null
let outputChart: echarts.ECharts | null = null

// 计算属性
const remainingQuota = computed(() => {
  if (userInfo.value?.isUnlimited) return '无限'
  return Math.max(0, (userInfo.value?.quotaDaily || 0) - (userInfo.value?.quotaUsed || 0))
})

const quotaPercentage = computed(() => {
  if (userInfo.value?.isUnlimited) return 0
  const daily = userInfo.value?.quotaDaily || 0
  if (daily === 0) return 0
  return Math.round(((userInfo.value?.quotaUsed || 0) / daily) * 100)
})

// API 实例（使用临时 API key）
function createApiInstance(tempKey: string) {
  return axios.create({
    baseURL: import.meta.env.VITE_ADMIN_WORKER_URL || 'https://agate-admin.pundi.workers.dev',
    timeout: 30000,
    headers: {
      'x-api-key': tempKey,
    },
  })
}

// 加载用户数据
async function loadUserData() {
  const key = inputApiKey.value.trim() || route.query.apiKey as string

  if (!key || !key.startsWith('sk-')) {
    error.value = '请输入有效的 API Key'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const api = createApiInstance(key)

    // 获取用户信息
    const userResponse = await api.get<AuthContext>('/user/auth')
    userInfo.value = userResponse.data
    apiKey.value = key

    // 存储到 sessionStorage 方便刷新
    sessionStorage.setItem('public_api_key', key)

    // 加载 Token 使用统计
    await loadTokenUsage()
  } catch (err: any) {
    error.value = err.response?.data?.error?.message || err.message || '加载失败，请检查 API Key'
  } finally {
    loading.value = false
  }
}

// 加载 Token 使用统计
async function loadTokenUsage() {
  if (!apiKey.value) return

  try {
    const api = createApiInstance(apiKey.value)

    // 并行加载汇总数据和趋势数据
    const [usageResponse, trendResponse] = await Promise.all([
      api.get<TokenUsageResponse>(`/user/stats/tokens?period=${period.value}`),
      api.get<{ period: string; start_at: number; end_at: number; grouped: TokenTrendData[] }>(
        `/user/stats/tokens/trend?period=${period.value}`
      ),
    ])

    tokenUsage.value = usageResponse.data
    tokenTrend.value = trendResponse.data.grouped || []

    await nextTick()
    renderCharts()
  } catch (err) {
    console.error('Failed to load token usage:', err)
  }
}

// 渲染图表
function renderCharts() {
  renderTrendChart()
  renderTotalChart()
  renderInputChart()
  renderOutputChart()
}

// 格式化 token 数值
function formatTokens(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return value.toString()
}

function renderTrendChart() {
  if (!trendChartRef.value) return

  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  // 按时间分组的数据
  const data = tokenTrend.value || []

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
}

function renderTotalChart() {
  if (!totalChartRef.value) return

  if (!totalChart) {
    totalChart = echarts.init(totalChartRef.value)
  }

  const data = tokenUsage.value.by_entity?.map((e) => ({
    name: e.entity_name || e.entity_id,
    value: e.total_tokens,
  })) || []

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
}

function renderInputChart() {
  if (!inputChartRef.value) return

  if (!inputChart) {
    inputChart = echarts.init(inputChartRef.value)
  }

  const data = tokenUsage.value.by_entity?.map((e) => ({
    name: e.entity_name || e.entity_id,
    value: e.input_tokens,
  })) || []

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
}

function renderOutputChart() {
  if (!outputChartRef.value) return

  if (!outputChart) {
    outputChart = echarts.init(outputChartRef.value)
  }

  const data = tokenUsage.value.by_entity?.map((e) => ({
    name: e.entity_name || e.entity_id,
    value: e.output_tokens,
  })) || []

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
}

// 清除 API Key
function clearApiKey() {
  apiKey.value = ''
  userInfo.value = null
  tokenUsage.value = {
    period: 'week',
    start_at: Date.now() - 86400000 * 7,
    end_at: Date.now(),
    total_tokens: 0,
    input_tokens: 0,
    output_tokens: 0,
    by_entity: [],
  }
  tokenTrend.value = []
  sessionStorage.removeItem('public_api_key')
  inputApiKey.value = ''
  stopAutoRefresh()
}

// 获取刷新间隔毫秒数
function getIntervalMs(interval: RefreshInterval): number {
  switch (interval) {
    case '30s': return 30000
    case '1m': return 60000
    case '5m': return 300000
    default: return 0
  }
}

// 开始自动刷新
function startAutoRefresh() {
  stopAutoRefresh()
  const intervalMs = getIntervalMs(autoRefreshInterval.value)
  if (intervalMs > 0) {
    timerRef.value = window.setInterval(() => {
      loadTokenUsage()
    }, intervalMs)
  }
}

// 停止自动刷新
function stopAutoRefresh() {
  if (timerRef.value !== null) {
    clearInterval(timerRef.value)
    timerRef.value = null
  }
}

// 刷新间隔变化
function onRefreshIntervalChange(value: RefreshInterval) {
  localStorage.setItem('stats_refresh_interval', value)
  if (value === 'off') {
    stopAutoRefresh()
  } else {
    startAutoRefresh()
  }
}

// 初始化
onMounted(() => {
  // 从 URL 参数或 sessionStorage 获取 API key
  const urlKey = route.query.apiKey as string
  const storedKey = sessionStorage.getItem('public_api_key')

  if (urlKey) {
    inputApiKey.value = urlKey
    loadUserData()
  } else if (storedKey) {
    inputApiKey.value = storedKey
    loadUserData()
  }

  // 恢复刷新间隔设置
  const savedInterval = localStorage.getItem('stats_refresh_interval') as RefreshInterval
  if (savedInterval && refreshOptions.some(o => o.value === savedInterval)) {
    autoRefreshInterval.value = savedInterval
    if (savedInterval !== 'off') {
      startAutoRefresh()
    }
  }

  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    trendChart?.resize()
    totalChart?.resize()
    inputChart?.resize()
    outputChart?.resize()
  })
})

// 清理
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.public-stats-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.api-key-card {
  max-width: 500px;
  margin: 40px auto;
}

.api-key-input {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.api-key-input h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.api-key-input p {
  margin: 0;
  color: #666;
}

.user-info-card {
  margin-bottom: 24px;
}

.user-info-card h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.quota-grid {
  margin-bottom: 24px;
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

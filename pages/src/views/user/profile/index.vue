<template>
  <div class="profile-page">
    <n-card title="个人信息">
      <n-descriptions :column="2" bordered>
        <n-descriptions-item label="用户 ID">
          {{ userStore.userId }}
        </n-descriptions-item>
        <n-descriptions-item label="用户名">
          {{ userStore.userName }}
        </n-descriptions-item>
        <n-descriptions-item label="邮箱">
          {{ userStore.userEmail }}
        </n-descriptions-item>
        <n-descriptions-item label="角色">
          <n-tag :type="userStore.isAdmin ? 'error' : 'default'">
            {{ userStore.isAdmin ? '管理员' : '普通用户' }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="公司">
          {{ userStore.companyName }}
        </n-descriptions-item>
        <n-descriptions-item label="部门">
          {{ userStore.departmentName || '无' }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>

    <n-card title="API Key 配额" style="margin-top: 16px;">
      <n-space vertical>
        <n-alert type="info" v-if="userStore.userInfo?.isUnlimited">
          您的 API Key 拥有无限配额
        </n-alert>

        <div v-else>
          <div class="quota-item">
            <div class="quota-label">
              <span>每日配额</span>
              <span class="quota-value">
                {{ formatNumber(userStore.userInfo?.quotaUsed || 0) }} /
                {{ formatNumber(userStore.userInfo?.quotaDaily || 0) }}
              </span>
            </div>
            <n-progress
              type="line"
              :percentage="dailyQuotaPercentage"
              :color="getQuotaColor(dailyQuotaPercentage)"
              :show-indicator="false"
            />
          </div>

          <div class="quota-item" v-if="userStore.userInfo?.quotaBonus > 0">
            <div class="quota-label">
              <span>奖励配额</span>
              <span class="quota-value">
                {{ formatNumber(userStore.userInfo!.quotaBonus) }}
              </span>
            </div>
            <n-alert type="success" size="small">
              有效期至: {{ formatDate(userStore.userInfo!.quotaBonusExpiry!) }}
            </n-alert>
          </div>
        </div>

        <n-alert
          v-if="!userStore.userInfo?.isUnlimited && dailyQuotaPercentage >= 90"
          type="warning"
          title="配额即将用尽"
        >
          您的每日配额即将用尽，请联系管理员申请更多配额
        </n-alert>

        <n-alert
          v-if="!userStore.userInfo?.isActive"
          type="error"
          title="API Key 已禁用"
        >
          您的 API Key 已被禁用，请联系管理员
        </n-alert>

        <n-alert
          v-if="userStore.userInfo?.expiresAt && userStore.userInfo.expiresAt < Date.now()"
          type="error"
          title="API Key 已过期"
        >
          您的 API Key 已过期，请联系管理员
        </n-alert>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NDescriptions, NDescriptionsItem, NTag, NSpace, NProgress, NAlert } from 'naive-ui'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'

const userStore = useUserStore()

const dailyQuotaPercentage = computed(() => {
  if (userStore.userInfo?.isUnlimited) return 0
  const used = userStore.userInfo?.quotaUsed || 0
  const total = userStore.userInfo?.quotaDaily || 1
  return Math.min((used / total) * 100, 100)
})

function formatNumber(num: number): string {
  return num.toLocaleString()
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '无'
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}

function getQuotaColor(percentage: number): string {
  if (percentage >= 90) return '#f56c6c'
  if (percentage >= 70) return '#e6a23c'
  return '#18a058'
}
</script>

<style scoped>
.profile-page {
  max-width: 900px;
}

.quota-item {
  margin-bottom: 16px;
}

.quota-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
}

.quota-value {
  font-weight: 600;
}
</style>

/**
 * Format Utilities Unit Tests
 *
 * Example unit test for utility functions
 */

import { describe, it, expect } from 'vitest'

/**
 * Format timestamp to localized date string
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN')
}

/**
 * Format number with thousands separator
 */
function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

/**
 * Format quota usage as "used / total"
 */
function formatQuotaUsage(used: number, total: number): string {
  return `${formatNumber(used)} / ${formatNumber(total)}`
}

describe('Format Utilities', () => {
  describe('formatDate', () => {
    it('should format timestamp to Chinese localized string', () => {
      const timestamp = 1704067200000 // 2024-01-01 00:00:00
      const result = formatDate(timestamp)
      expect(result).toContain('2024')
    })

    it('should handle current timestamp', () => {
      const now = Date.now()
      const result = formatDate(now)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('formatNumber', () => {
    it('should add thousands separator', () => {
      expect(formatNumber(1000)).toBe('1,000')
      expect(formatNumber(1000000)).toBe('1,000,000')
      expect(formatNumber(1234567)).toBe('1,234,567')
    })

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0')
    })

    it('should handle negative numbers', () => {
      expect(formatNumber(-1000)).toBe('-1,000')
    })
  })

  describe('formatQuotaUsage', () => {
    it('should format quota usage correctly', () => {
      expect(formatQuotaUsage(100, 1000)).toBe('100 / 1,000')
      expect(formatQuotaUsage(1234, 5678)).toBe('1,234 / 5,678')
    })

    it('should handle zero values', () => {
      expect(formatQuotaUsage(0, 0)).toBe('0 / 0')
      expect(formatQuotaUsage(100, 0)).toBe('100 / 0')
    })
  })
})

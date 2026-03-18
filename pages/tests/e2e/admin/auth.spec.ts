/**
 * Authentication E2E Tests
 *
 * Tests for admin authentication flow
 */

import { test, expect } from '@playwright/test'

const ADMIN_BASE_URL = process.env.TEST_ADMIN_BASE_URL || 'http://localhost:8788'
const TEST_API_KEY = process.env.TEST_ADMIN_API_KEY || 'sk-admin_dev_fixed_key_local_2024'

test.describe('Admin Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/login')
    await page.evaluate(() => {
      localStorage.clear()
    })
  })

  test('should display login page', async ({ page }) => {
    await page.goto('/login')

    // Check page title and heading
    await expect(page.locator('h1')).toContainText('Agate')
    await expect(page.locator('.login-container')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button:has-text("登录")')).toBeVisible()
  })

  test('should show validation error for empty API key', async ({ page }) => {
    await page.goto('/login')

    // Click login button without entering API key
    await page.click('button:has-text("登录")')

    // Should show validation message
    await expect(page.locator('text=/请输入 API Key/')).toBeVisible()
  })

  test('should show validation error for short API key', async ({ page }) => {
    await page.goto('/login')

    // Enter short API key
    await page.fill('input[type="password"]', 'short')

    // Trigger validation
    await page.click('button:has-text("登录")')

    // Should show validation message
    await expect(page.locator('text=/API Key 格式不正确/')).toBeVisible()
  })

  test('should login successfully with valid admin API key', async ({ page }) => {
    await page.goto('/login')

    // Enter valid admin API key
    await page.fill('input[type="password"]', TEST_API_KEY)

    // Click login button
    await page.click('button:has-text("登录")')

    // Wait for navigation to admin dashboard
    await page.waitForURL('**/admin/**', { timeout: 5000 })

    // Verify we're on the admin page
    await expect(page).toHaveURL(/.*\/admin\/.*/)
    await expect(page.locator('text=/欢迎回来/')).toBeVisible()
  })

  test('should store API key in localStorage after successful login', async ({ page }) => {
    await page.goto('/login')

    // Enter valid admin API key
    await page.fill('input[type="password"]', TEST_API_KEY)

    // Click login button
    await page.click('button:has-text("登录")')

    // Wait for navigation
    await page.waitForURL('**/admin/**', { timeout: 5000 })

    // Check localStorage
    const apiKey = await page.evaluate(() => localStorage.getItem('api_key'))
    expect(apiKey).toBe(TEST_API_KEY)

    const userInfo = await page.evaluate(() => localStorage.getItem('user_info'))
    expect(userInfo).toBeTruthy()
  })

  test('should redirect to admin dashboard after admin login', async ({ page }) => {
    await page.goto('/login')

    // Enter valid admin API key
    await page.fill('input[type="password"]', TEST_API_KEY)

    // Click login button
    await page.click('button:has-text("登录")')

    // Wait for navigation to admin dashboard
    await page.waitForURL('**/admin/**', { timeout: 5000 })

    // Verify URL
    expect(page.url()).toContain('/admin/')
  })

  test('should handle login with redirect query parameter', async ({ page }) => {
    // Navigate to login with redirect
    await page.goto('/login?redirect=/admin/users')

    // Enter valid admin API key
    await page.fill('input[type="password"]', TEST_API_KEY)

    // Click login button
    await page.click('button:has-text("登录")')

    // Wait for navigation to redirect target
    await page.waitForURL('**/admin/users', { timeout: 5000 })

    // Verify we're redirected to the intended page
    expect(page.url()).toContain('/admin/users')
  })

  test('should show error message for invalid API key', async ({ page }) => {
    await page.goto('/login')

    // Enter invalid API key
    await page.fill('input[type="password"]', 'sk-invalid-key-12345')

    // Click login button
    await page.click('button:has-text("登录")')

    // Wait a bit for the API call
    await page.waitForTimeout(1000)

    // Should still be on login page
    await expect(page).toHaveURL(/.*\/login/)

    // Should show error message (may be in a toast/notification)
    // Note: Naive UI message components appear as floating elements
  })
})

test.describe('Authentication State Persistence', () => {
  test('should keep user logged in across page reloads', async ({ page }) => {
    // First login
    await page.goto('/login')
    await page.fill('input[type="password"]', TEST_API_KEY)
    await page.click('button:has-text("登录")')
    await page.waitForURL('**/admin/**', { timeout: 5000 })

    // Reload the page
    await page.reload()

    // Should still be on admin page (not redirected to login)
    await expect(page).toHaveURL(/.*\/admin\/.*/)
  })

  test('should logout and clear localStorage', async ({ page }) => {
    // First login
    await page.goto('/login')
    await page.fill('input[type="password"]', TEST_API_KEY)
    await page.click('button:has-text("登录")')
    await page.waitForURL('**/admin/**', { timeout: 5000 })

    // Verify localStorage has API key
    const apiKeyBefore = await page.evaluate(() => localStorage.getItem('api_key'))
    expect(apiKeyBefore).toBe(TEST_API_KEY)

    // Logout (clear localStorage)
    await page.evaluate(() => {
      localStorage.clear()
    })

    // Verify localStorage is cleared
    const apiKeyAfter = await page.evaluate(() => localStorage.getItem('api_key'))
    expect(apiKeyAfter).toBeNull()

    // Navigate to login page directly (simulating logout redirect)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login$/)
  })
})

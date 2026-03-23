import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'pinia',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar'
          ]
        }
      ],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, '../../packages/shared/src'),
      '@shared/types': resolve(__dirname, '../../packages/shared/src/types'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/admin': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        // 只代理 API 请求（不包含 text/html 的 Accept 头）
        bypass: (req, res, options) => {
          if (req.headers.accept?.includes('text/html')) {
            // HTML 导航请求：返回 index.html
            return '/index.html'
          }
        },
      },
      '/user': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        bypass: (req, res, options) => {
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html'
          }
        },
      },
    },
  },
  // @ts-ignore - test config for vitest
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/auto-imports.d.ts',
        'src/components.d.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 30000,
  },
})

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <MessageSetup />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { defineComponent, h, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { RouterView } from 'vue-router'
import { setMessageApi } from '@/shared/api/request'
import type { GlobalThemeOverrides } from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#18a058',
    primaryColorHover: '#36ad6a',
    primaryColorPressed: '#0c7a43',
  },
}

// 内部组件，用于获取 message API
const MessageSetup = defineComponent({
  name: 'MessageSetup',
  setup() {
    const message = useMessage()

    onMounted(() => {
      setMessageApi({
        error: message.error,
        warning: message.warning,
      })
    })

    return () => h(RouterView)
  },
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    sans-serif;
}
</style>

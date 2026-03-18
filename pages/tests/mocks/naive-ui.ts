/**
 * Naive UI Component Mocks
 *
 * Proper mocks for Naive UI components to avoid Vue warnings
 */

import { vi } from 'vitest'

// Mock Naive UI components with proper props
export const NCard = {
  name: 'NCard',
  props: ['title', 'size', 'bordered', 'hoverable'],
  emits: [],
  template: '<div class="n-card" :class="`n-card--${size || 'medium'}`"><slot name="header-extra" /><slot /></div>',
}

export const NSpace = {
  name: 'NSpace',
  props: ['vertical', 'align', 'justify', 'size'],
  emits: [],
  template: '<div class="n-space" :style="{ display: \'flex\', flexDirection: vertical ? \'column\' : \'row\' }"><slot /></div>',
}

export const NButton = {
  name: 'NButton',
  props: ['type', 'size', 'disabled', 'loading', 'ghost', 'text', 'tag', 'attrType'],
  emits: ['click'],
  template: '<button :class="`n-button n-button--${type || 'default'}`" :disabled="disabled || loading" @click="$emit(\'click\', $event)"><slot /></button>',
}

export const NInput = {
  name: 'NInput',
  props: ['value', 'type', 'placeholder', 'disabled', 'clearable', 'size', 'showPasswordOn', 'maxlength'],
  emits: ['update:value', 'change', 'focus', 'blur'],
  template: '<input :type="type || \'text\'" :value="value" :placeholder="placeholder" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" @change="$emit(\'change\', $event)" @focus="$emit(\'focus\', $event)" @blur="$emit(\'blur\', $event)" />',
}

export const NInputNumber = {
  name: 'NInputNumber',
  props: ['value', 'min', 'max', 'step', 'precision', 'disabled', 'placeholder', 'size'],
  emits: ['update:value', 'change'],
  template: '<input type="number" :value="value" :min="min" :max="max" :step="step" :disabled="disabled" :placeholder="placeholder" @input="$emit(\'update:value\', Number($event.target.value))" @change="$emit(\'change\', Number($event.target.value))" />',
}

export const NSelect = {
  name: 'NSelect',
  props: ['value', 'options', 'placeholder', 'disabled', 'clearable', 'multiple', 'filterable', 'size'],
  emits: ['update:value', 'change'],
  computed: {
    displayValue() {
      if (this.multiple && Array.isArray(this.value)) {
        return this.value.join(', ')
      }
      const option = this.options?.find((opt: any) => opt.value === this.value)
      return option?.label || this.value || ''
    }
  },
  template: '<select :value="value" :disabled="disabled" :multiple="multiple" @change="$emit(\'update:value\', $event.target.value); $emit(\'change\', $event.target.value)"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select>',
}

export const NDataTable = {
  name: 'NDataTable',
  props: ['columns', 'data', 'loading', 'pagination', 'bordered'],
  emits: ['update:page'],
  template: '<div class="n-data-table"><table v-if="!loading"><thead><tr><th v-for="col in columns" :key="col.key">{{ col.title }}</th></tr></thead><tbody><tr v-for="(row, i) in data" :key="i"><td v-for="col in columns" :key="col.key">{{ col.render ? col.render(row) : row[col.key] }}</td></tr></tbody></table><div v-else>Loading...</div></div>',
}

export const NModal = {
  name: 'NModal',
  props: ['show', 'preset', 'title', 'style'],
  emits: ['update:show'],
  template: '<div v-if="show" class="n-modal"><slot /></div>',
}

export const NForm = {
  name: 'NForm',
  props: ['model', 'rules', 'labelPlacement', 'labelWidth', 'size'],
  emits: [],
  template: '<form class="n-form"><slot /></form>',
}

export const NFormItem = {
  name: 'NFormItem',
  props: ['label', 'path', 'rule'],
  emits: [],
  template: '<div class="n-form-item"><label v-if="label">{{ label }}</label><slot /></div>',
}

export const NRadioGroup = {
  name: 'NRadioGroup',
  props: ['value', 'name', 'size'],
  emits: ['update:value'],
  template: '<div class="n-radio-group"><slot /></div>',
}

export const NRadio = {
  name: 'NRadio',
  props: ['value', 'name', 'disabled'],
  emits: [],
  inject: ['radioGroup'],
  computed: {
    isChecked() {
      return this.radioGroup?.value === this.value
    }
  },
  template: '<label class="n-radio"><input type="radio" :name="name" :value="value" :checked="isChecked" :disabled="disabled" /><slot /></label>',
  provide() {
    return {
      radioGroup: null
    }
  }
}

export const NTag = {
  name: 'NTag',
  props: ['type', 'size', 'bordered', 'strong'],
  emits: [],
  template: '<span :class="`n-tag n-tag--${type || 'default'}`"><slot /></span>',
}

export const NSwitch = {
  name: 'NSwitch',
  props: ['value', 'disabled', 'size'],
  emits: ['update:value'],
  template: '<input type="checkbox" class="n-switch" :checked="value" :disabled="disabled" @change="$emit(\'update:value\', $event.target.checked)" />',
}

export const NPopconfirm = {
  name: 'NPopconfirm',
  props: ['show', 'disabled'],
  emits: ['positiveClick', 'negativeClick'],
  template: '<div class="n-popconfirm"><slot name="trigger" /></div>',
}

export const NFormItemCol = {
  name: 'NFormItemCol',
  props: ['label', 'path', 'span'],
  emits: [],
  template: '<div class="n-form-item-col"><slot /></div>',
}

export const NGrid = {
  name: 'NGrid',
  props: ['cols', 'xGap', 'yGap', 'responsive'],
  emits: [],
  template: '<div class="n-grid" :style="{ display: \'flex\', flexWrap: \'wrap\', gap: `${yGap || 0}px ${xGap || 0}px` }"><slot /></div>',
}

export const NGridItem = {
  name: 'NGridItem',
  props: ['span', 'offset'],
  emits: [],
  template: '<div class="n-grid-item" :style="{ flex: span ? `0 0 calc(${span} * 100% / 12)` : \'1 1 0\' }"><slot /></div>',
}

export const NCollapse = {
  name: 'NCollapse',
  props: ['accordion', 'defaultExpandedNames'],
  emits: [],
  template: '<div class="n-collapse"><slot /></div>',
}

export const NCollapseItem = {
  name: 'NCollapseItem',
  props: ['title', 'name'],
  emits: [],
  template: '<div class="n-collapse-item"><div class="n-collapse-item__header">{{ title }}</div><div class="n-collapse-item__content"><slot /></div></div>',
}

export const NDropdown = {
  name: 'NDropdown',
  props: ['options', 'placement', 'trigger'],
  emits: ['select', 'clickoutside'],
  template: '<div class="n-dropdown"><slot /></div>',
}

export const NTooltip = {
  name: 'NTooltip',
  props: ['show', 'placement', 'trigger'],
  emits: [],
  template: '<div class="n-tooltip"><slot /></div>',
}

export const NStatistic = {
  name: 'NStatistic',
  props: ['label', 'value'],
  emits: [],
  template: '<div class="n-statistic"><div class="n-statistic__label">{{ label }}</div><div class="n-statistic__value">{{ value }}</div></div>',
}

export const NCountdown = {
  name: 'NCountdown',
  props: ['duration', 'active', 'precision'],
  emits: ['finish'],
  template: '<div class="n-countdown">{{ duration }}</div>',
}

export const NProgress = {
  name: 'NProgress',
  props: ['type', 'percentage', 'indicatorPlacement', 'processing'],
  emits: [],
  template: '<div class="n-progress"><div class="n-progress__fill" :style="{ width: percentage + \'%\' }"></div></div>',
}

export const NSpin = {
  name: 'NSpin',
  props: ['show', 'description', 'size'],
  emits: [],
  template: '<div v-if="show" class="n-spin">Loading...</div><slot v-else />',
}

export const NEmpty = {
  name: 'NEmpty',
  props: ['description', 'size'],
  emits: [],
  template: '<div class="n-empty"><div class="n-empty__description">{{ description || \'暂无数据\' }}</div></div>',
}

export const NAlert = {
  name: 'NAlert',
  props: ['type', 'title', 'description'],
  emits: [],
  template: '<div :class="`n-alert n-alert--${type || 'info'}`"><div v-if="title" class="n-alert__title">{{ title }}</div><div class="n-alert__description">{{ description }}</div></div>',
}

export const NResult = {
  name: 'NResult',
  props: ['status', 'title', 'description'],
  emits: [],
  template: '<div :class="`n-result n-result--${status || 'info'}`"><div class="n-result__title">{{ title }}</div><div class="n-result__description">{{ description }}</div><slot name="footer" /></div>',
}

export const NMenu = {
  name: 'NMenu',
  props: ['options', 'mode', 'collapsed', 'collapsedWidth', 'collapsedIconSize', 'expandedKeys', 'value'],
  emits: ['update:value', 'update:expandedKeys'],
  template: '<div class="n-menu"><div v-for="opt in options" :key="opt.key" class="n-menu__item">{{ opt.label }}</div></div>',
}

export const NMenuItem = {
  name: 'NMenuItem',
  props: ['key'],
  emits: [],
  template: '<div class="n-menu-item"><slot /></div>',
}

export const NSubmenu = {
  name: 'NSubmenu',
  props: ['key', 'title', 'expanded'],
  emits: [],
  template: '<div class="n-submenu"><div class="n-submenu__title">{{ title }}</div><slot /></div>',
}

export const NBreadcrumb = {
  name: 'NBreadcrumb',
  props: ['separator'],
  emits: [],
  template: '<div class="n-breadcrumb"><slot /></div>',
}

export const NBreadcrumbItem = {
  name: 'NBreadcrumbItem',
  props: ['href', 'clickable'],
  emits: ['click'],
  template: '<span class="n-breadcrumb-item"><slot /></span>',
}

export const NTabs = {
  name: 'NTabs',
  props: ['value', 'type', 'animated'],
  emits: ['update:value'],
  template: '<div class="n-tabs"><div class="n-tabs__nav"><slot /></div></div>',
}

export const NTabPane = {
  name: 'NTabPane',
  props: ['tab', 'name', 'disabled'],
  emits: [],
  template: '<div class="n-tab-pane"><slot /></div>',
}

export const NCheckbox = {
  name: 'NCheckbox',
  props: ['value', 'checked', 'disabled', 'indeterminate'],
  emits: ['update:checked'],
  template: '<input type="checkbox" :checked="checked" :disabled="disabled" @change="$emit(\'update:checked\', $event.target.checked)" /><slot />',
}

export const NCheckboxGroup = {
  name: 'NCheckboxGroup',
  props: ['value', 'disabled'],
  emits: ['update:value'],
  template: '<div class="n-checkbox-group"><slot /></div>',
}

export const NDatePicker = {
  name: 'NDatePicker',
  props: ['value', 'type', 'placeholder', 'disabled', 'clearable'],
  emits: ['update:value', 'change'],
  template: '<input type="date" :value="value" :placeholder="placeholder" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" />',
}

export const NTimePicker = {
  name: 'NTimePicker',
  props: ['value', 'placeholder', 'disabled', 'clearable'],
  emits: ['update:value', 'change'],
  template: '<input type="time" :value="value" :placeholder="placeholder" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" />',
}

export const NColorPicker = {
  name: 'NColorPicker',
  props: ['value', 'disabled', 'alpha'],
  emits: ['update:value', 'change'],
  template: '<input type="color" :value="value" :disabled="disabled" @input="$emit(\'update:value\', $event.target.value)" />',
}

export const NSlider = {
  name: 'NSlider',
  props: ['value', 'min', 'max', 'step', 'disabled', 'marks'],
  emits: ['update:value'],
  template: '<input type="range" :value="value" :min="min" :max="max" :step="step" :disabled="disabled" @input="$emit(\'update:value\', Number($event.target.value))" />',
}

export const NRate = {
  name: 'NRate',
  props: ['value', 'count', 'size', 'clearable', 'readonly', 'disabled'],
  emits: ['update:value'],
  template: '<div class="n-rate"><span v-for="i in count" :key="i">{{ i <= value ? '★' : '☆' }}</span></div>',
}

export const NTransfer = {
  name: 'NTransfer',
  props: ['value', 'options', 'disabled'],
  emits: ['update:value'],
  template: '<div class="n-transfer"><div class="n-transfer__source">Source</div><div class="n-transfer__target">Target</div></div>',
}

export const NTree = {
  name: 'NTree',
  props: ['data', 'checkedKeys', 'expandedKeys', 'checkable'],
  emits: ['update:checkedKeys', 'update:expandedKeys', 'nodeClick'],
  template: '<div class="n-tree"><div v-for="item in data" :key="item.key">{{ item.label }}</div></div>',
}

export const NCascader = {
  name: 'NCascader',
  props: ['value', 'options', 'placeholder', 'disabled', 'filterable'],
  emits: ['update:value', 'change'],
  template: '<input :value="value" :placeholder="placeholder" :disabled="disabled" />',
}

export const NTimeline = {
  name: 'NTimeline',
  props: ['horizontal'],
  emits: [],
  template: '<div class="n-timeline"><slot /></div>',
}

export const NTimelineItem = {
  name: 'NTimelineItem',
  props: ['time', 'title', 'type'],
  emits: [],
  template: '<div class="n-timeline-item"><div class="n-timeline-item__time">{{ time }}</div><div class="n-timeline-item__title">{{ title }}</div><slot /></div>',
}

export const NList = {
  name: 'NList',
  props: ['bordered', 'hoverable', 'showScrollbar'],
  emits: [],
  template: '<div class="n-list"><slot /></div>',
}

export const NListItem = {
  name: 'NListItem',
  emits: [],
  template: '<div class="n-list-item"><slot /></div>',
}

export const NCardGrid = {
  name: 'NCardGrid',
  props: ['bordered', 'hoverable'],
  emits: [],
  template: '<div class="n-card-grid"><slot /></div>',
}

// Helper function to create mock for useMessage, useDialog, etc.
export function createComposableMock() {
  return {
    useMessage: () => ({
      create: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(),
    }),
    useDialog: () => ({
      create: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    }),
    useNotification: () => ({
      create: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    }),
    useLoadingBar: () => ({
      start: vi.fn(),
      finish: vi.fn(),
      error: vi.fn(),
    }),
  }
}

// Export all components as an object for easier importing
export const naiveUiMocks = {
  NCard,
  NSpace,
  NButton,
  NInput,
  NInputNumber,
  NSelect,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NFormItemCol,
  NRadioGroup,
  NRadio,
  NTag,
  NSwitch,
  NPopconfirm,
  NGrid,
  NGridItem,
  NCollapse,
  NCollapseItem,
  NDropdown,
  NTooltip,
  NStatistic,
  NCountdown,
  NProgress,
  NSpin,
  NEmpty,
  NAlert,
  NResult,
  NMenu,
  NMenuItem,
  NSubmenu,
  NBreadcrumb,
  NBreadcrumbItem,
  NTabs,
  NTabPane,
  NCheckbox,
  NCheckboxGroup,
  NDatePicker,
  NTimePicker,
  NColorPicker,
  NSlider,
  NRate,
  NTransfer,
  NTree,
  NCascader,
  NTimeline,
  NTimelineItem,
  NList,
  NListItem,
  NCardGrid,
}

export default naiveUiMocks

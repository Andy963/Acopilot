<script setup lang="ts">
/**
 * Locate（/locate）配置面板
 *
 * 用于指定 locate 模式使用的模型：
 * - 留空：使用当前对话模型
 * - 填写：覆盖本次 /locate 请求使用的 model
 */

import { ref, onMounted } from 'vue'
import { sendToExtension } from '@/utils/vscode'
import { CustomSelect, type SelectOption } from '../../../common'
import { t } from '@/i18n'

const model = ref<string>('')
const isLoading = ref(false)
const isLoadingModels = ref(false)
const isSaving = ref(false)
const modelOptions = ref<SelectOption[]>([])

async function loadConfig() {
  isLoading.value = true
  try {
    const resp = await sendToExtension<{ config: { model?: string } }>('tools.getToolConfig', {
      toolName: 'locate'
    })
    model.value = typeof resp?.config?.model === 'string' ? resp.config.model : ''
  } catch (err) {
    console.error('Failed to load locate config:', err)
  } finally {
    isLoading.value = false
  }
}

async function loadModelOptions() {
  isLoadingModels.value = true
  try {
    const resp = await sendToExtension<{ channelId?: string }>('settings.getActiveChannelId', {})
    const channelId = typeof resp?.channelId === 'string' ? resp.channelId.trim() : ''

    const ids = new Set<string>()

    // Include current configured locate model even if it's not in the channel model list.
    if (model.value.trim()) {
      ids.add(model.value.trim())
    }

    if (channelId) {
      const cfg = await sendToExtension<any>('config.getConfig', { configId: channelId })
      const active = typeof cfg?.model === 'string' ? cfg.model.trim() : ''
      if (active) ids.add(active)

      const list = Array.isArray(cfg?.models) ? cfg.models : []
      for (const m of list) {
        const id = typeof m?.id === 'string' ? m.id.trim() : ''
        if (id) ids.add(id)
      }
    }

    const options: SelectOption[] = [
      { value: '', label: t('components.settings.toolSettings.lsp.locate.useChatModelOption') }
    ]

    const sorted = Array.from(ids).sort((a, b) => a.localeCompare(b))
    for (const id of sorted) {
      options.push({ value: id, label: id })
    }

    modelOptions.value = options
  } catch (err) {
    console.error('Failed to load locate model options:', err)
    modelOptions.value = [
      { value: '', label: t('components.settings.toolSettings.lsp.locate.useChatModelOption') }
    ]
  } finally {
    isLoadingModels.value = false
  }
}

async function saveConfig() {
  isSaving.value = true
  try {
    await sendToExtension('tools.updateToolConfig', {
      toolName: 'locate',
      config: {
        model: model.value.trim()
      }
    })
  } catch (err) {
    console.error('Failed to save locate config:', err)
  } finally {
    isSaving.value = false
  }
}

function handleModelChange(value: string) {
  model.value = value
  saveConfig()
}

onMounted(() => {
  loadConfig().then(loadModelOptions)
})
</script>

<template>
  <div class="locate-config">
    <div class="config-section">
      <div class="section-header">
        <i class="codicon codicon-symbol-method"></i>
        <span>{{ t('components.settings.toolSettings.lsp.locate.title') }}</span>
        <span class="hint">{{ t('components.settings.toolSettings.lsp.locate.hint') }}</span>
      </div>

      <div class="section-content">
        <div v-if="isLoading" class="loading-state">
          <i class="codicon codicon-loading codicon-modifier-spin"></i>
          <span>{{ t('components.settings.toolSettings.common.loading') }}</span>
        </div>

        <div v-else class="row">
          <label class="label">{{ t('components.settings.toolSettings.lsp.locate.modelLabel') }}</label>
          <CustomSelect
            class="select"
            :model-value="model"
            :options="modelOptions"
            searchable
            :disabled="isSaving || isLoadingModels"
            :placeholder="t('components.settings.toolSettings.lsp.locate.modelPlaceholder')"
            @update:modelValue="handleModelChange"
          />
          <button class="save-btn" :disabled="isSaving" @click="saveConfig">
            <i class="codicon" :class="isSaving ? 'codicon-loading codicon-modifier-spin' : 'codicon-save'"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.locate-config {
  padding: 12px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 4px;
  margin-top: 8px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vscode-foreground);
}

.section-header .codicon {
  font-size: 14px;
  color: var(--vscode-charts-yellow);
}

.hint {
  font-size: 11px;
  font-weight: normal;
  color: var(--vscode-descriptionForeground);
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 12px;
  color: var(--vscode-foreground);
}

.input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--vscode-input-border);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border-radius: 2px;
  font-size: 12px;
  font-family: var(--vscode-font-family);
}

.select {
  width: 100%;
}

.save-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  color: var(--vscode-foreground);
  cursor: pointer;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.save-btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}
</style>

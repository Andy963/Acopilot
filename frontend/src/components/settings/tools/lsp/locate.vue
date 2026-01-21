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
import { t } from '@/i18n'

const model = ref<string>('')
const isLoading = ref(false)
const isSaving = ref(false)

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

onMounted(() => {
  loadConfig()
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
          <input
            v-model="model"
            class="input"
            type="text"
            :placeholder="t('components.settings.toolSettings.lsp.locate.modelPlaceholder')"
            @blur="saveConfig"
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


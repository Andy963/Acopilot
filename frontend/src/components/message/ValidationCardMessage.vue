<script setup lang="ts">
/**
 * ValidationCardMessage - 改动后校验提示卡片
 *
 * 在检测到文件改动后，引导用户运行 build/test/lint 等命令，
 * 并通过 execute_command 将结果写回对话（可折叠查看输出）。
 */

import { computed, onMounted, ref } from 'vue'
import { useChatStore } from '../../stores'
import { useSettingsStore } from '../../stores/settingsStore'
import { sendToExtension } from '../../utils/vscode'

const chatStore = useChatStore()
const settingsStore = useSettingsStore()

interface PostEditValidationPreset {
  id: string
  label: string
  command: string
  cwd?: string
  shell?: string
  timeout?: number
  kind?: 'build' | 'test' | 'lint' | 'custom'
  enabled?: boolean
}

const expanded = ref(true)
const loading = ref(false)
const loadError = ref<string | null>(null)

const enabled = ref(true)
const presets = ref<PostEditValidationPreset[]>([])

const hasPresets = computed(() => presets.value.length > 0)

async function loadPresets() {
  loading.value = true
  loadError.value = null
  try {
    const resp = await sendToExtension<{ config: any }>('tools.getExecuteCommandConfig', {})
    const cfg = resp?.config || {}
    const pe = cfg.postEditValidation || {}

    enabled.value = pe.enabled ?? true
    const list = Array.isArray(pe.presets) ? pe.presets : []
    presets.value = list.filter((p: any) => p && p.command && p.enabled !== false)
  } catch (err: any) {
    loadError.value = err?.message || 'Failed to load validation presets'
  } finally {
    loading.value = false
  }
}

function openSettings() {
  settingsStore.showSettings('tools')
}

function dismiss() {
  chatStore.postEditValidationPending = false
}

async function runPreset(preset: PostEditValidationPreset) {
  if (!preset?.command) return
  await chatStore.runPostEditValidationCommand({
    label: preset.label,
    command: preset.command,
    cwd: preset.cwd,
    shell: preset.shell,
    timeout: preset.timeout
  })
}

onMounted(() => {
  loadPresets()
})
</script>

<template>
  <div class="validation-card">
    <div class="validation-header" @click="expanded = !expanded">
      <i class="codicon" :class="expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
      <i class="codicon codicon-checklist validation-icon"></i>
      <span class="validation-title">验证</span>
      <span v-if="!enabled" class="validation-subtitle">（已关闭）</span>
      <div class="validation-header-actions" @click.stop>
        <button class="validation-btn link" @click="openSettings">打开设置</button>
        <button class="validation-btn icon" title="关闭" @click="dismiss">
          <i class="codicon codicon-close"></i>
        </button>
      </div>
    </div>

    <div v-if="expanded" class="validation-body">
      <div v-if="loading" class="validation-muted">加载校验预设中…</div>
      <div v-else-if="loadError" class="validation-error">{{ loadError }}</div>

      <template v-else>
        <div v-if="!enabled" class="validation-muted">
          已在设置中关闭“改动后校验提示”。
        </div>

        <template v-else>
          <div v-if="!hasPresets" class="validation-muted">
            未配置校验预设：可在 execute_command 设置中添加 build/test/lint 命令。
          </div>

          <div v-else class="validation-actions">
            <button
              v-for="p in presets"
              :key="p.id"
              class="validation-btn primary"
              :title="p.command"
              @click="runPreset(p)"
            >
              <i class="codicon codicon-play"></i>
              {{ p.label || p.kind || 'Run' }}
            </button>
          </div>

          <div class="validation-hint">
            结果将以 <code>execute_command</code> 工具消息写回对话（输出可折叠查看）。
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.validation-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.04);
  overflow: hidden;
}

.validation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
}

.validation-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.validation-icon {
  color: var(--vscode-textLink-foreground);
}

.validation-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--vscode-foreground);
}

.validation-subtitle {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.validation-header-actions {
  margin-left: auto;
}

.validation-body {
  padding: 12px;
  border-top: 1px solid var(--vscode-panel-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.validation-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.validation-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.validation-btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.validation-btn.primary {
  border: none;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.validation-btn.link {
  border: none;
  background: transparent;
  color: var(--vscode-textLink-foreground);
  padding: 0;
}

.validation-btn.icon {
  border: none;
  background: transparent;
  padding: 0 4px;
}

.validation-muted {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.validation-error {
  font-size: 12px;
  color: var(--vscode-editorError-foreground);
  white-space: pre-wrap;
}

.validation-hint {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.validation-hint code {
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
}
</style>

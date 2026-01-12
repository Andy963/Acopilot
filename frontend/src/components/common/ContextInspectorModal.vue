<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from './Modal.vue'
import type { ContextInspectorData, ContextInspectorModule } from '../../types'
import { copyToClipboard } from '../../utils/format'
import { useI18n } from '../../i18n'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  modelValue: boolean
  loading?: boolean
  error?: string | null
  data?: ContextInspectorData | null
  source?: 'preview' | 'message'
}>(), {
  loading: false,
  error: null,
  data: null,
  source: 'preview'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  refresh: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const expandedTitles = ref<Set<string>>(new Set())
const copied = ref(false)

function toggleModule(module: ContextInspectorModule) {
  const key = module.title
  const next = new Set(expandedTitles.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedTitles.value = next
}

function isExpanded(module: ContextInspectorModule): boolean {
  return expandedTitles.value.has(module.title)
}

async function handleCopyDebug() {
  if (!props.data) return
  const ok = await copyToClipboard(JSON.stringify(props.data, null, 2))
  copied.value = ok
  if (ok) {
    setTimeout(() => {
      copied.value = false
    }, 1200)
  }
}

const title = computed(() => {
  return props.source === 'message'
    ? t('components.common.contextInspectorModal.titleUsed')
    : t('components.common.contextInspectorModal.title')
})

const providerSummary = computed(() => {
  const data = props.data
  if (!data) return ''
  return `${data.providerType} · ${data.model}`
})
</script>

<template>
  <Modal v-model="visible" :title="title" width="820px">
    <div class="context-inspector">
      <div v-if="loading" class="state-row">
        <i class="codicon codicon-loading codicon-modifier-spin"></i>
        <span>{{ t('common.loading') }}</span>
      </div>

      <div v-else-if="error" class="state-row error">
        <i class="codicon codicon-error"></i>
        <span>{{ error }}</span>
      </div>

      <div v-else-if="!data" class="state-row">
        <i class="codicon codicon-info"></i>
        <span>{{ t('components.common.contextInspectorModal.noData') }}</span>
      </div>

      <template v-else>
        <!-- Summary -->
        <div class="summary">
          <div class="summary-row">
            <span class="summary-title">{{ providerSummary }}</span>
            <span class="summary-muted">config: <code>{{ data.configId }}</code></span>
            <span class="summary-muted">toolMode: <code>{{ data.tools.toolMode }}</code></span>
          </div>
          <div class="summary-row">
            <span class="summary-muted">
              tools: <code>{{ data.tools.total }}</code>
              <span v-if="data.tools.mcp"> · mcp: <code>{{ data.tools.mcp }}</code></span>
            </span>
            <span class="summary-muted">
              systemInstruction: <code>{{ data.systemInstructionCharCount }}</code>
              <span v-if="data.systemInstructionTruncated">({{ t('common.truncated') }})</span>
            </span>
            <span class="summary-muted">
              generatedAt: <code>{{ new Date(data.generatedAt).toLocaleString() }}</code>
            </span>
          </div>
        </div>

        <!-- Trim -->
        <div v-if="data.trim" class="block">
          <div class="block-title">
            <i class="codicon codicon-filter"></i>
            <span>{{ t('components.common.contextInspectorModal.trim.title') }}</span>
          </div>
          <div class="kv">
            <div class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.trim.fullHistory') }}</span>
              <span class="v"><code>{{ data.trim.fullHistoryCount }}</code></span>
            </div>
            <div class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.trim.trimmedHistory') }}</span>
              <span class="v"><code>{{ data.trim.trimmedHistoryCount }}</code></span>
            </div>
            <div class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.trim.trimStartIndex') }}</span>
              <span class="v"><code>{{ data.trim.trimStartIndex }}</code></span>
            </div>
            <div class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.trim.lastSummaryIndex') }}</span>
              <span class="v"><code>{{ data.trim.lastSummaryIndex }}</code></span>
            </div>
          </div>
        </div>

        <!-- Tools Definition -->
        <div v-if="data.tools.definitionPreview" class="block">
          <div class="block-title">
            <i class="codicon codicon-tools"></i>
            <span>{{ t('components.common.contextInspectorModal.tools.title') }}</span>
            <span class="block-meta">
              <code>{{ data.tools.definitionCharCount || 0 }}</code>
              <span v-if="data.tools.definitionTruncated">({{ t('common.truncated') }})</span>
            </span>
          </div>
          <pre class="pre">{{ data.tools.definitionPreview }}</pre>
        </div>

        <!-- Modules -->
        <div class="block">
          <div class="block-title">
            <i class="codicon codicon-symbol-folder"></i>
            <span>{{ t('components.common.contextInspectorModal.modules.title') }}</span>
          </div>
          <div class="modules">
            <div
              v-for="(m, idx) in data.modules"
              :key="`${m.title}-${idx}`"
              class="module"
            >
              <button class="module-header" @click="toggleModule(m)">
                <i class="codicon" :class="isExpanded(m) ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
                <span class="module-title">{{ m.title }}</span>
                <span class="module-meta">
                  <code>{{ m.charCount }}</code>
                  <span v-if="m.truncated">({{ t('common.truncated') }})</span>
                </span>
              </button>
              <pre v-if="isExpanded(m)" class="pre module-content">{{ m.contentPreview }}</pre>
            </div>
          </div>
        </div>

        <!-- Raw -->
        <div class="block">
          <div class="block-title">
            <i class="codicon codicon-code"></i>
            <span>{{ t('components.common.contextInspectorModal.raw.title') }}</span>
            <span class="block-meta">
              <code>{{ data.systemInstructionCharCount }}</code>
              <span v-if="data.systemInstructionTruncated">({{ t('common.truncated') }})</span>
            </span>
          </div>
          <pre class="pre">{{ data.systemInstructionPreview }}</pre>
        </div>
      </template>
    </div>

    <template #footer>
      <button
        v-if="source === 'preview'"
        class="btn"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <i class="codicon codicon-refresh"></i>
        {{ t('common.refresh') }}
      </button>

      <button class="btn" :disabled="!data" @click="handleCopyDebug">
        <i class="codicon" :class="copied ? 'codicon-check' : 'codicon-copy'"></i>
        {{ copied ? t('common.copied') : t('components.common.contextInspectorModal.copyDebug') }}
      </button>

      <button class="btn primary" @click="visible = false">
        {{ t('common.close') }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.context-inspector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.state-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  color: var(--vscode-descriptionForeground);
}

.state-row.error {
  color: var(--vscode-errorForeground);
  border-color: rgba(255, 100, 100, 0.35);
  background: rgba(255, 100, 100, 0.08);
}

.summary {
  padding: 10px 12px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.08));
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.summary-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.summary-muted {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.block {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  overflow: hidden;
}

.block-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
  background: rgba(0, 0, 0, 0.08);
  border-bottom: 1px solid var(--vscode-panel-border);
}

.block-meta {
  margin-left: auto;
  font-weight: 400;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
}

.kv {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.k {
  width: 180px;
  flex-shrink: 0;
}

.v {
  flex: 1;
  min-width: 0;
}

.modules {
  display: flex;
  flex-direction: column;
}

.module {
  border-top: 1px solid var(--vscode-panel-border);
}

.module:first-child {
  border-top: none;
}

.module-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: var(--vscode-foreground);
  cursor: pointer;
  text-align: left;
}

.module-header:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.module-title {
  font-size: 12px;
  font-weight: 600;
}

.module-meta {
  margin-left: auto;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.pre {
  margin: 0;
  padding: 10px 12px;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
  background: rgba(0, 0, 0, 0.12);
  color: var(--vscode-foreground);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.primary {
  border: none;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.btn.primary:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}
</style>


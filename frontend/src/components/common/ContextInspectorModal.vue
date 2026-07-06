<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from './Modal.vue'
import type { ContextInspectorData, ContextInspectorModule } from '../../types'
import { copyToClipboard } from '../../utils/format'
import { useI18n } from '../../i18n'

const { t, actualLanguage } = useI18n()

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

function formatTimestamp(ts: number): string {
  if (!Number.isFinite(ts)) return ''

  const lang = actualLanguage.value
  const locale = lang === 'en' ? 'en-US' : lang

  const date = new Date(ts)
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: locale.startsWith('zh') ? false : undefined
    })
    return formatter.format(date)
  } catch {
    return date.toISOString()
  }
}

const MODULE_TITLE_KEYS: Record<string, string> = {
  'TEXT': 'components.common.contextInspectorModal.modules.labels.text',
  'ENVIRONMENT': 'components.common.contextInspectorModal.modules.labels.environment',
  'WORKSPACE FILES': 'components.common.contextInspectorModal.modules.labels.workspaceFiles',
  'PINNED FILES': 'components.common.contextInspectorModal.modules.labels.pinnedFiles',
  'TOOLS': 'components.common.contextInspectorModal.modules.labels.tools',
  'MCP TOOLS': 'components.common.contextInspectorModal.modules.labels.mcpTools',
  'GUIDELINES': 'components.common.contextInspectorModal.modules.labels.guidelines',
  'OPEN TABS': 'components.common.contextInspectorModal.modules.labels.openTabs',
  'ACTIVE EDITOR': 'components.common.contextInspectorModal.modules.labels.activeEditor',
  'DIAGNOSTICS': 'components.common.contextInspectorModal.modules.labels.diagnostics',
  'SELECTION REFERENCES': 'components.common.contextInspectorModal.modules.labels.selectionReferences'
}

function formatModuleTitle(rawTitle: string): string {
  const key = MODULE_TITLE_KEYS[String(rawTitle || '').trim().toUpperCase()]
  return key ? t(key) : rawTitle
}

function estimateTokensFromChars(chars: number): number {
  if (!Number.isFinite(chars) || chars <= 0) return 0
  return Math.max(1, Math.ceil(chars / 4))
}

const estimatedSystemTokens = computed(() => {
  if (!props.data) return 0
  return estimateTokensFromChars(props.data.systemInstructionCharCount)
})

const moduleTokens = computed(() => {
  const data = props.data
  if (!data) return []

  const rows = (data.modules || []).map((m) => ({
    ...m,
    tokens: estimateTokensFromChars(m.charCount)
  }))

  const total = rows.reduce((sum, r) => sum + (r.tokens || 0), 0)
  return rows.map((r) => ({
    ...r,
    percent: total > 0 ? (r.tokens / total) * 100 : 0
  }))
})

const hasInjected = computed(() => {
  const injected = props.data?.injected
  if (!injected) return false
  return Boolean(
    injected.pinnedFiles ||
    injected.pinnedSelections ||
    injected.attachments ||
    (injected.pinnedPrompt && injected.pinnedPrompt.mode !== 'none')
  )
})

const pinnedPromptSummary = computed(() => {
  const p = props.data?.injected?.pinnedPrompt
  if (!p || p.mode === 'none') return ''

  if (p.mode === 'skill') {
    if (p.skillName && p.skillId) return `${p.skillName} (${p.skillId})`
    return p.skillName || p.skillId || 'skill'
  }

  if (p.mode === 'preset') {
    if (p.presetName && p.presetId) return `${p.presetName} (${p.presetId})`
    return p.presetName || p.presetId || 'preset'
  }

  if (p.mode === 'custom') {
    const count = typeof p.customPromptCharCount === 'number' ? p.customPromptCharCount : 0
    return t('components.common.contextInspectorModal.injected.pinnedPromptCustom', { count })
  }

  return ''
})

const pinnedFilesListText = computed(() => {
  const pf = props.data?.injected?.pinnedFiles
  if (!pf || !Array.isArray(pf.files) || pf.files.length === 0) return ''
  return pf.files
    .map(f => `${f.path}${f.included === false ? ` (${t('components.common.contextInspectorModal.injected.missing')})` : ''}`)
    .join('\n')
})

const attachmentsListText = computed(() => {
  const a = props.data?.injected?.attachments
  if (!a || !Array.isArray(a.items) || a.items.length === 0) return ''
  return a.items
    .map(item => {
      const meta: string[] = []
      if (item.mimeType) meta.push(item.mimeType)
      if (typeof item.size === 'number') meta.push(`${item.size}B`)
      return meta.length > 0 ? `${item.name} (${meta.join(', ')})` : item.name
    })
    .join('\n')
})

const pinnedSelectionsListText = computed(() => {
  const s = props.data?.injected?.pinnedSelections
  if (!s || !Array.isArray(s.items) || s.items.length === 0) return ''
  return s.items
    .map(item => {
      const range = item.startLine
        ? (item.endLine ? `#L${item.startLine}-L${item.endLine}` : `#L${item.startLine}`)
        : ''
      const meta: string[] = []
      if (item.languageId) meta.push(item.languageId)
      if (typeof item.charCount === 'number') meta.push(`${item.charCount}ch`)
      if (item.truncated) meta.push(t('common.truncated'))
      return meta.length > 0 ? `${item.path}${range} (${meta.join(', ')})` : `${item.path}${range}`
    })
    .join('\n')
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
            <span class="summary-muted">{{ t('components.common.contextInspectorModal.summary.config') }}: <code>{{ data.configId }}</code></span>
            <span class="summary-muted">{{ t('components.common.contextInspectorModal.summary.toolMode') }}: <code>{{ data.tools.toolMode }}</code></span>
          </div>
          <div class="summary-row">
            <span class="summary-muted">
              {{ t('components.common.contextInspectorModal.summary.tools') }}: <code>{{ data.tools.total }}</code>
              <span v-if="data.tools.mcp"> · {{ t('components.common.contextInspectorModal.summary.mcp') }}: <code>{{ data.tools.mcp }}</code></span>
            </span>
            <span class="summary-muted">
              {{ t('components.common.contextInspectorModal.summary.systemInstruction') }}: <code>{{ estimatedSystemTokens }}</code> tok · <code>{{ data.systemInstructionCharCount }}</code> ch
              <span v-if="data.systemInstructionTruncated">({{ t('common.truncated') }})</span>
            </span>
            <span class="summary-muted">
              {{ t('components.common.contextInspectorModal.summary.generatedAt') }}: <code>{{ formatTimestamp(data.generatedAt) }}</code>
            </span>
          </div>
        </div>

        <!-- Injected -->
        <div v-if="hasInjected" class="block">
          <div class="block-title">
            <i class="codicon codicon-symbol-property"></i>
            <span>{{ t('components.common.contextInspectorModal.injected.title') }}</span>
          </div>
          <div class="kv">
            <div v-if="data.injected?.pinnedFiles" class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.injected.pinnedFiles') }}</span>
              <span class="v"><code>{{ data.injected.pinnedFiles.included }} / {{ data.injected.pinnedFiles.totalEnabled }}</code></span>
            </div>
            <div v-if="pinnedPromptSummary" class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.injected.pinnedPrompt') }}</span>
              <span class="v"><code>{{ pinnedPromptSummary }}</code></span>
            </div>
            <div v-if="data.injected?.pinnedSelections" class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.injected.pinnedSelections') }}</span>
              <span class="v"><code>{{ data.injected.pinnedSelections.count }}</code></span>
            </div>
            <div v-if="data.injected?.attachments" class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.injected.attachments') }}</span>
              <span class="v"><code>{{ data.injected.attachments.count }}</code></span>
            </div>
          </div>

          <div v-if="pinnedSelectionsListText" class="injected-list">
            <div class="injected-list-title">{{ t('components.common.contextInspectorModal.injected.pinnedSelections') }}</div>
            <pre class="pre">{{ pinnedSelectionsListText }}</pre>
          </div>
          <div v-if="pinnedFilesListText" class="injected-list">
            <div class="injected-list-title">{{ t('components.common.contextInspectorModal.injected.pinnedFiles') }}</div>
            <pre class="pre">{{ pinnedFilesListText }}</pre>
          </div>
          <div v-if="attachmentsListText" class="injected-list">
            <div class="injected-list-title">{{ t('components.common.contextInspectorModal.injected.attachments') }}</div>
            <pre class="pre">{{ attachmentsListText }}</pre>
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
            <div v-if="data.trim.summary?.summarizedMessageCount" class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.trim.summarizedMessages') }}</span>
              <span class="v"><code>{{ data.trim.summary.summarizedMessageCount }}</code></span>
            </div>
            <div v-if="data.trim.summary?.keptRecentRounds !== undefined" class="kv-row">
              <span class="k">{{ t('components.common.contextInspectorModal.trim.keptRounds') }}</span>
              <span class="v"><code>{{ data.trim.summary.keptRecentRounds }}</code></span>
            </div>
          </div>
          <div v-if="data.trim.summary?.preview" class="injected-list">
            <div class="injected-list-title">
              {{ t('components.common.contextInspectorModal.trim.summaryPreview') }}
              <span v-if="data.trim.summary.truncated">({{ t('common.truncated') }})</span>
            </div>
            <pre class="pre">{{ data.trim.summary.preview }}</pre>
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
              v-for="(m, idx) in moduleTokens"
              :key="`${m.title}-${idx}`"
              class="module"
            >
              <button class="module-header" @click="toggleModule(m)">
                <i class="codicon" :class="isExpanded(m) ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
                <span class="module-title" :title="m.title">{{ formatModuleTitle(m.title) }}</span>
                <span class="module-meta">
                  <code>{{ m.tokens }}</code> tok · <code>{{ m.charCount }}</code> ch · {{ m.percent.toFixed(1) }}%
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

<style scoped src="./ContextInspectorModal.css"></style>

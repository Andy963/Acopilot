<script setup lang="ts">
/**
 * ContextUsedMessage - 对话内“Context Used”摘要卡片
 *
 * 使用后端写入到每条助手消息上的 contextSnapshot（Context Inspector 快照），
 * 以 Copilot 类似的方式在对话流中展示本条回复注入了哪些上下文（Pinned Files / Pinned Prompt / Attachments）。
 */

import { computed, ref } from 'vue'
import type { ContextInspectorData, ContextInspectorModule, ContextInjectedAttachment, ContextInjectedPinnedFile } from '../../types'
import { useI18n } from '../../i18n'
import { formatFileSize } from '../../utils/file'

const { t } = useI18n()

const props = defineProps<{
  snapshot: ContextInspectorData
}>()

const emit = defineEmits<{
  openDetails: []
}>()

const expanded = ref(false)

const injected = computed(() => props.snapshot?.injected)
const pinnedFiles = computed(() => injected.value?.pinnedFiles)
const pinnedPrompt = computed(() => injected.value?.pinnedPrompt)
const attachments = computed(() => injected.value?.attachments)

const hasInjected = computed(() => {
  const i = injected.value
  if (!i) return false
  return Boolean(
    i.pinnedFiles ||
    i.attachments ||
    (i.pinnedPrompt && i.pinnedPrompt.mode !== 'none')
  )
})

const pinnedPromptSummary = computed(() => {
  const p = pinnedPrompt.value
  if (!p || p.mode === 'none') return ''

  if (p.mode === 'skill') {
    if (p.skillName && p.skillId) return `${p.skillName} (${p.skillId})`
    return p.skillName || p.skillId || 'skill'
  }

  if (p.mode === 'custom') {
    const count = typeof p.customPromptCharCount === 'number' ? p.customPromptCharCount : 0
    return t('components.common.contextInspectorModal.injected.pinnedPromptCustom', { count })
  }

  return ''
})

function isIncludedPinnedFile(file: ContextInjectedPinnedFile): boolean {
  // included 为空时视为 included（向后兼容）
  return file.included !== false
}

const pinnedFilesUsedCount = computed(() => {
  const pf = pinnedFiles.value
  if (!pf) return 0
  if (typeof pf.included === 'number') return pf.included
  return Array.isArray(pf.files) ? pf.files.filter(isIncludedPinnedFile).length : 0
})

const attachmentsCount = computed(() => {
  const a = attachments.value
  if (!a) return 0
  if (typeof a.count === 'number') return a.count
  return Array.isArray(a.items) ? a.items.length : 0
})

const pinnedPromptCount = computed(() => (pinnedPromptSummary.value ? 1 : 0))

const referenceCount = computed(() => pinnedFilesUsedCount.value + attachmentsCount.value + pinnedPromptCount.value)

const headerMeta = computed(() => {
  const parts: string[] = []

  const pf = pinnedFiles.value
  if (pf) {
    parts.push(`${t('components.common.contextInspectorModal.injected.pinnedFiles')} ${pinnedFilesUsedCount.value}/${pf.totalEnabled}`)
  }

  if (pinnedPromptSummary.value) {
    parts.push(`${t('components.common.contextInspectorModal.injected.pinnedPrompt')} ${pinnedPromptSummary.value}`)
  }

  const a = attachments.value
  if (a) {
    parts.push(`${t('components.common.contextInspectorModal.injected.attachments')} ${attachmentsCount.value}`)
  }

  return parts.join(' · ')
})

function isPinnedPromptModule(m: ContextInspectorModule): boolean {
  const title = String(m?.title || '').trim().toUpperCase()
  if (!title) return false
  if (title.startsWith('SKILL')) return true
  if (title.startsWith('PINNED PROMPT')) return true
  return false
}

const pinnedPromptModulePreview = computed(() => {
  if (!pinnedPromptSummary.value) return null
  const mods = props.snapshot?.modules
  if (!Array.isArray(mods) || mods.length === 0) return null
  return mods.find(isPinnedPromptModule) || null
})

function formatAttachmentMeta(item: ContextInjectedAttachment): string {
  const meta: string[] = []
  if (item.mimeType) meta.push(item.mimeType)
  if (typeof item.size === 'number' && Number.isFinite(item.size)) meta.push(formatFileSize(item.size))
  return meta.length > 0 ? meta.join(', ') : ''
}
</script>

<template>
  <div v-if="hasInjected" class="context-used-card">
    <div class="context-used-header" @click="expanded = !expanded">
      <i class="codicon" :class="expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
      <i class="codicon codicon-references context-used-icon"></i>
      <span class="context-used-title">{{ t('components.message.stats.contextUsed') }}</span>
      <span v-if="headerMeta" class="context-used-meta">{{ headerMeta }}</span>
      <span v-if="referenceCount > 0" class="context-used-count">({{ referenceCount }})</span>

      <div class="context-used-actions" @click.stop>
        <button class="context-used-btn" @click="emit('openDetails')">
          <i class="codicon codicon-eye"></i>
          {{ t('components.message.stats.contextUsed') }}
        </button>
      </div>
    </div>

    <div v-if="expanded" class="context-used-body">
      <div v-if="pinnedPromptSummary" class="section">
        <div class="section-title">{{ t('components.common.contextInspectorModal.injected.pinnedPrompt') }}</div>
        <div class="section-kv"><code>{{ pinnedPromptSummary }}</code></div>
        <pre v-if="pinnedPromptModulePreview" class="pre">{{ pinnedPromptModulePreview.contentPreview }}</pre>
      </div>

      <div v-if="pinnedFiles?.files && pinnedFiles.files.length > 0" class="section">
        <div class="section-title">{{ t('components.common.contextInspectorModal.injected.pinnedFiles') }}</div>
        <div class="list">
          <div v-for="f in pinnedFiles.files" :key="f.id || f.path" class="list-row">
            <code class="list-code">{{ f.path }}</code>
            <span v-if="f.included === false" class="missing">
              ({{ t('components.common.contextInspectorModal.injected.missing') }})
            </span>
          </div>
        </div>
      </div>

      <div v-if="attachments?.items && attachments.items.length > 0" class="section">
        <div class="section-title">{{ t('components.common.contextInspectorModal.injected.attachments') }}</div>
        <div class="list">
          <div v-for="a in attachments.items" :key="a.id || a.name" class="list-row">
            <code class="list-code">{{ a.name }}</code>
            <span v-if="formatAttachmentMeta(a)" class="meta">({{ formatAttachmentMeta(a) }})</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.context-used-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.04);
  overflow: hidden;
  margin-top: 10px;
}

.context-used-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
}

.context-used-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.context-used-icon {
  color: var(--vscode-textLink-foreground);
}

.context-used-title {
  font-weight: 600;
  font-size: 12px;
  color: var(--vscode-foreground);
  flex-shrink: 0;
}

.context-used-meta {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.context-used-count {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
}

.context-used-actions {
  margin-left: auto;
  flex-shrink: 0;
}

.context-used-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: 11px;
}

.context-used-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.context-used-body {
  padding: 10px;
  border-top: 1px solid var(--vscode-panel-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--vscode-foreground);
  margin-bottom: 6px;
}

.section-kv {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 6px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.list-code {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.meta {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  flex-shrink: 0;
}

.missing {
  font-size: 11px;
  color: var(--vscode-errorForeground);
  flex-shrink: 0;
}

.pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 11px;
  line-height: 1.4;
  padding: 8px;
  border-radius: 6px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  max-height: 180px;
  overflow: auto;
}
</style>


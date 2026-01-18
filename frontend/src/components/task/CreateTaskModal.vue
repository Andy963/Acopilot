<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { IconButton, Modal, Tooltip } from '../common'
import { useChatStore } from '../../stores'
import { copyToClipboard, generateId } from '../../utils/format'
import { sendToExtension, showNotification } from '../../utils/vscode'
import { useI18n } from '../../i18n'

type IssueProvider = 'github' | 'unknown'

interface IssueCommentInfo {
  id: number
  user: string
  createdAt: string
  body: string
  url?: string
}

interface IssueInfo {
  provider: IssueProvider
  repo: string
  number: number
  title: string
  body: string
  labels: string[]
  commentsTotal?: number
  comments?: IssueCommentInfo[]
  imageUrls?: string[]
  url: string
}

interface TaskCardData {
  id: string
  createdAt: number
  issueUrl: string
  provider: IssueProvider
  repo?: string
  number?: number
  title?: string
  intentSummary: string
  prompt: string
  taskContext?: string
}

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useI18n()
const chatStore = useChatStore()

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const issueUrl = ref('')
const issue = ref<IssueInfo | null>(null)
const fetchError = ref('')
const isFetching = ref(false)

const isAnalyzing = ref(false)
const analysisProgress = ref(0)
const intentSummary = ref('')
const suggestedPrompt = ref('')
const taskContext = ref('')
const promptExpanded = ref(true)

let fetchTimer: ReturnType<typeof setTimeout> | null = null
let analyzeTimer: ReturnType<typeof setInterval> | null = null

function resetState() {
  issueUrl.value = ''
  issue.value = null
  fetchError.value = ''
  isFetching.value = false
  isAnalyzing.value = false
  analysisProgress.value = 0
  intentSummary.value = ''
  suggestedPrompt.value = ''
  taskContext.value = ''
  promptExpanded.value = true
}

function stopTimers() {
  if (fetchTimer) {
    clearTimeout(fetchTimer)
    fetchTimer = null
  }
  if (analyzeTimer) {
    clearInterval(analyzeTimer)
    analyzeTimer = null
  }
}

watch(visible, (val) => {
  if (val) return
  stopTimers()
  resetState()
})

watch(issueUrl, (val) => {
  const url = String(val || '').trim()

  stopTimers()
  issue.value = null
  fetchError.value = ''
  isFetching.value = false
  isAnalyzing.value = false
  analysisProgress.value = 0
  intentSummary.value = ''
  suggestedPrompt.value = ''
  taskContext.value = ''

  if (!url) return

  isFetching.value = true
  fetchTimer = setTimeout(async () => {
    try {
      const res = await sendToExtension<{ issue: IssueInfo }>('issue.fetch', { url })
      issue.value = res?.issue || null
    } catch (err: any) {
      fetchError.value = err?.message || String(err || 'Failed to fetch issue')
    } finally {
      isFetching.value = false
    }
  }, 350)
})

watch(issue, (val) => {
  if (!val) return
  runAnalyze(val)
})

function runAnalyze(val: IssueInfo) {
  stopTimers()

  isAnalyzing.value = true
  analysisProgress.value = 0

  analyzeTimer = setInterval(() => {
    analysisProgress.value = Math.min(95, analysisProgress.value + 12)
  }, 120)

  setTimeout(() => {
    stopTimers()
    analysisProgress.value = 100
    isAnalyzing.value = false

    const title = (val.title || '').trim()
    const repo = (val.repo || '').trim()
    const num = val.number
    const labels = Array.isArray(val.labels) ? val.labels.map(l => String(l || '').trim()).filter(Boolean) : []

    const MAX_ISSUE_BODY_CHARS = 12000
    const rawBody = String(val.body || '').replace(/\r\n/g, '\n').trim()
    const body = rawBody.length > MAX_ISSUE_BODY_CHARS ? rawBody.slice(0, MAX_ISSUE_BODY_CHARS) : rawBody
    const bodyTruncated = rawBody.length > MAX_ISSUE_BODY_CHARS

    const comments = Array.isArray(val.comments) ? val.comments : []
    const commentsTotal = typeof val.commentsTotal === 'number' ? val.commentsTotal : comments.length
    const MAX_COMMENT_BODY_CHARS = 4000

    intentSummary.value = title
      ? `${repo ? `${repo} ` : ''}${num ? `#${num} ` : ''}${title}`.trim()
      : `Analyze issue: ${val.url}`

    const lines: string[] = []
    const contextLines: string[] = []
    if (repo && num) {
      lines.push(`Fix GitHub issue ${repo}#${num}${title ? `: ${title}` : ''}`)
      contextLines.push(`${repo}#${num}${title ? `: ${title}` : ''}`)
    } else if (title) {
      lines.push(`Fix issue: ${title}`)
      contextLines.push(title)
    } else {
      lines.push('Fix the issue described below')
    }

    if (val.url) lines.push(`Issue URL: ${val.url}`)
    if (labels.length > 0) lines.push(`Labels: ${labels.join(', ')}`)
    if (val.url) contextLines.push(`Issue URL: ${val.url}`)
    if (labels.length > 0) contextLines.push(`Labels: ${labels.join(', ')}`)

    if (body) {
      lines.push('')
      lines.push('Issue description (verbatim):')
      lines.push('<issue_body>')
      lines.push(body)
      if (bodyTruncated) lines.push('\n[...truncated...]')
      lines.push('</issue_body>')

      contextLines.push('')
      contextLines.push('Issue description (verbatim):')
      contextLines.push('<issue_body>')
      contextLines.push(body)
      if (bodyTruncated) contextLines.push('\n[...truncated...]')
      contextLines.push('</issue_body>')
    }

    if (comments.length > 0) {
      lines.push('')
      lines.push(`Issue comments (first ${comments.length}${commentsTotal > comments.length ? ` of ${commentsTotal}` : ''}):`)
      lines.push('<issue_comments>')

      contextLines.push('')
      contextLines.push(`Issue comments (first ${comments.length}${commentsTotal > comments.length ? ` of ${commentsTotal}` : ''}):`)
      contextLines.push('<issue_comments>')
      for (const c of comments) {
        const who = String(c?.user || '').trim() || 'unknown'
        const when = String(c?.createdAt || '').trim()
        const header = when ? `@${who} (${when})` : `@${who}`

        const raw = String(c?.body || '').replace(/\r\n/g, '\n').trim()
        const clipped = raw.length > MAX_COMMENT_BODY_CHARS ? raw.slice(0, MAX_COMMENT_BODY_CHARS) : raw
        const truncated = raw.length > MAX_COMMENT_BODY_CHARS

        lines.push(header)
        if (clipped) lines.push(clipped)
        if (truncated) lines.push('\n[...truncated...]')
        lines.push('---')

        contextLines.push(header)
        if (clipped) contextLines.push(clipped)
        if (truncated) contextLines.push('\n[...truncated...]')
        contextLines.push('---')
      }
      lines.push('</issue_comments>')
      contextLines.push('</issue_comments>')
    }

    const imageUrls = Array.isArray(val.imageUrls) ? val.imageUrls.map(u => String(u || '').trim()).filter(Boolean) : []
    if (imageUrls.length > 0) {
      lines.push('')
      lines.push(`Images referenced in issue/comments (${imageUrls.length}):`)
      for (const u of imageUrls.slice(0, 10)) {
        lines.push(`- ${u}`)
      }
      if (imageUrls.length > 10) {
        lines.push('- ...')
      }

      contextLines.push('')
      contextLines.push(`Images referenced in issue/comments (${imageUrls.length}):`)
      for (const u of imageUrls.slice(0, 10)) {
        contextLines.push(`- ${u}`)
      }
      if (imageUrls.length > 10) {
        contextLines.push('- ...')
      }
    }

    lines.push('')
    lines.push('Task:')
    lines.push('- Reproduce the problem (if possible) and identify the root cause.')
    lines.push('- Implement a minimal fix; avoid unrelated refactors.')
    lines.push('- Add tests (or clear validation steps) to verify the fix.')

    suggestedPrompt.value = lines.join('\n')
    taskContext.value = contextLines.join('\n').trim()
  }, 900)
}

const canCreate = computed(() => suggestedPrompt.value.trim().length > 0)

function buildTaskCard(): TaskCardData {
  const now = Date.now()
  return {
    id: `task_${now}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    issueUrl: issueUrl.value.trim(),
    provider: issue.value?.provider || 'unknown',
    repo: issue.value?.repo,
    number: issue.value?.number,
    title: issue.value?.title,
    intentSummary: intentSummary.value.trim(),
    prompt: suggestedPrompt.value.trim(),
    taskContext: taskContext.value.trim() || undefined
  }
}

function insertTaskCardMessage(task: TaskCardData) {
  const msgId = `msg_${task.id}`
  chatStore.allMessages.push({
    id: msgId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    metadata: {
      taskCard: task
    }
  } as any)
}

async function handleOpenIssue() {
  const url = issueUrl.value.trim()
  if (!url) return
  try {
    await sendToExtension('issue.open', { url })
  } catch (err) {
    console.warn('Failed to open issue url:', err)
  }
}

async function handleCopyPrompt() {
  const text = suggestedPrompt.value.trim()
  if (!text) return
  const ok = await copyToClipboard(text)
  if (ok) {
    await showNotification(t('common.copy') + ' ' + t('common.success'), 'info')
  }
}

async function handleInsertToChat() {
  const text = suggestedPrompt.value.trim()
  if (!text) return
  chatStore.setInputValue(text)
  await showNotification(t('common.paste') + ' ' + t('common.success'), 'info')
}

async function handleCreate() {
  if (!canCreate.value) return
  const task = buildTaskCard()
  insertTaskCardMessage(task)
  visible.value = false
}

async function handleStart() {
  if (!canCreate.value) return
  const task = buildTaskCard()
  insertTaskCardMessage(task)
  const imageUrlsSnapshot = Array.isArray(issue.value?.imageUrls)
    ? issue.value!.imageUrls!.map(u => String(u || '').trim()).filter(Boolean)
    : []

  visible.value = false

  const prompt = task.prompt
  const taskContextText = String(task.taskContext || '').trim()
  if (!prompt) return

  try {
    if (chatStore.hasPendingToolConfirmation) {
      await chatStore.rejectPendingToolsWithAnnotation(prompt)
      return
    }

    const urls = imageUrlsSnapshot
    const attachments: any[] = []

    if (urls.length > 0) {
      try {
        const res = await sendToExtension<{
          success: boolean
          attachments?: Array<{ url: string; name: string; mimeType: string; size: number; data: string }>
        }>('issue.fetchImageAttachments', { urls, maxImages: 5 })

        const list = Array.isArray(res?.attachments) ? res!.attachments! : []
        for (const a of list) {
          if (!a?.data || !a?.mimeType) continue
          attachments.push({
            id: generateId(),
            name: a.name || 'issue-image',
            type: 'image',
            size: typeof a.size === 'number' ? a.size : a.data.length,
            mimeType: a.mimeType,
            data: a.data,
            thumbnail: `data:${a.mimeType};base64,${a.data}`,
            url: a.url
          })
        }
      } catch (err) {
        console.warn('Failed to fetch issue images as attachments:', err)
      }
    }

    const shouldAttachTaskContext =
      Boolean(taskContextText) && !prompt.includes('<issue_body>') && !prompt.includes('<issue_comments>')

    await chatStore.sendMessage(
      prompt,
      attachments.length > 0 ? (attachments as any) : undefined,
      shouldAttachTaskContext ? { taskContext: taskContextText } : undefined
    )
  } catch (err) {
    console.error('Failed to start task:', err)
  }
}

onBeforeUnmount(() => {
  stopTimers()
})
</script>

<template>
  <Modal v-model="visible" title="Create Task" width="640px">
    <div class="create-task">
      <div class="url-row">
        <input
          v-model="issueUrl"
          type="text"
          class="url-input"
          placeholder="Issue URL"
        />
        <Tooltip content="Open in browser" placement="left">
          <IconButton icon="codicon-link-external" size="small" :disabled="!issueUrl.trim()" @click="handleOpenIssue" />
        </Tooltip>
      </div>

      <div class="issue-card">
        <template v-if="isFetching">
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-90"></div>
          <div class="skeleton-line w-80"></div>
        </template>

        <template v-else-if="fetchError">
          <div class="issue-error">
            <i class="codicon codicon-error"></i>
            <span>{{ fetchError }}</span>
          </div>
        </template>

        <template v-else-if="issueUrl.trim()">
          <div class="issue-header">
            <i class="codicon" :class="issue?.provider === 'github' ? 'codicon-mark-github' : 'codicon-globe'"></i>
            <span class="issue-ref">
              <template v-if="issue?.repo && issue?.number">{{ issue.repo }}#{{ issue.number }}</template>
              <template v-else>Unrecognized URL</template>
            </span>
          </div>
          <div class="issue-title">
            <template v-if="issue?.title">{{ issue.title }}</template>
            <template v-else>Paste an issue URL to preview</template>
          </div>
        </template>

        <template v-else>
          <div class="issue-empty">
            <i class="codicon codicon-info"></i>
            <span>Paste an issue URL to start</span>
          </div>
        </template>
      </div>

      <div class="analyzing" v-if="issueUrl.trim()">
        <div class="analyzing-row">
          <i class="codicon codicon-sync spin" v-if="isAnalyzing"></i>
          <i class="codicon codicon-check" v-else-if="analysisProgress === 100"></i>
          <span>Analyzing intent...</span>
          <span class="analyzing-percent">{{ analysisProgress }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${analysisProgress}%` }"></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Intent Summary</div>
        <textarea v-model="intentSummary" class="textarea" rows="3" placeholder="Intent summary..."></textarea>
      </div>

      <div class="section">
        <div class="section-title section-title-row" @click="promptExpanded = !promptExpanded">
          <div class="section-title-left">
            <i class="codicon" :class="promptExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
            <span>Suggested prompt</span>
          </div>
          <div class="section-title-actions" @click.stop>
            <button class="mini-btn" :disabled="!suggestedPrompt.trim()" @click="handleCopyPrompt">{{ t('common.copy') }}</button>
            <button class="mini-btn" :disabled="!suggestedPrompt.trim()" @click="handleInsertToChat">Insert to chat</button>
          </div>
        </div>
        <textarea
          v-if="promptExpanded"
          v-model="suggestedPrompt"
          class="textarea textarea-mono"
          rows="6"
          placeholder="Suggested prompt..."
        ></textarea>
      </div>
    </div>

    <template #footer>
      <button class="footer-btn cancel" @click="visible = false">{{ t('common.cancel') }}</button>
      <button class="footer-btn" :disabled="!canCreate" @click="handleCreate">{{ t('common.create') }}</button>
      <button class="footer-btn primary" :disabled="!canCreate" @click="handleStart">
        <i class="codicon codicon-play"></i>
        {{ t('common.start') }}
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.create-task {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.url-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.url-input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.url-input:focus {
  border-color: var(--vscode-focusBorder);
}

.issue-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  background: var(--vscode-editor-background);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-header {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.issue-title {
  font-size: 13px;
  color: var(--vscode-foreground);
  line-height: 1.35;
}

.issue-empty,
.issue-error {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.issue-error {
  color: var(--vscode-errorForeground);
}

.skeleton-line {
  height: 10px;
  border-radius: 6px;
  background: rgba(127, 127, 127, 0.15);
  overflow: hidden;
  position: relative;
}

.skeleton-line::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(127, 127, 127, 0) 0%,
    rgba(127, 127, 127, 0.22) 50%,
    rgba(127, 127, 127, 0) 100%
  );
  animation: shimmer 1.2s infinite;
}

.w-60 {
  width: 60%;
}

.w-80 {
  width: 80%;
}

.w-90 {
  width: 90%;
}

@keyframes shimmer {
  0% {
    transform: translateX(-60%);
  }
  100% {
    transform: translateX(60%);
  }
}

.analyzing {
  padding: 10px 12px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.06);
}

.analyzing-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.analyzing-percent {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.progress-bar {
  height: 6px;
  margin-top: 8px;
  border-radius: 999px;
  background: rgba(127, 127, 127, 0.15);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--vscode-textLink-foreground);
  width: 0%;
  transition: width 0.15s ease;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.section-title-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.section-title-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.mini-btn {
  padding: 4px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  cursor: pointer;
}

.mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mini-btn:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.textarea {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--vscode-input-border);
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
  outline: none;
}

.textarea:focus {
  border-color: var(--vscode-focusBorder);
}

.textarea-mono {
  font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);
}

.footer-btn {
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.footer-btn:hover:not(:disabled) {
  background: var(--vscode-button-secondaryHoverBackground);
}

.footer-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.footer-btn.cancel {
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
}

.footer-btn.cancel:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.footer-btn.primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.footer-btn.primary:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}
</style>

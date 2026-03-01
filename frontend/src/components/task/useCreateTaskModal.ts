import { computed, onBeforeUnmount, ref, watch } from 'vue'
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

export interface CreateTaskModalProps {
  modelValue: boolean
}

export type CreateTaskModalEmit = {
  (e: 'update:modelValue', value: boolean): void
}

export function useCreateTaskModal(props: CreateTaskModalProps, emit: CreateTaskModalEmit) {
  const { t } = useI18n()
  const chatStore = useChatStore()

  const visible = computed({
    get: () => props.modelValue,
    set: (val: boolean) => emit('update:modelValue', val),
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
      const rawBody = String(val.body || '').replace(/\\r\\n/g, '\\n').trim()
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
        if (bodyTruncated) lines.push('\\n[...truncated...]')
        lines.push('</issue_body>')

        contextLines.push('')
        contextLines.push('Issue description (verbatim):')
        contextLines.push('<issue_body>')
        contextLines.push(body)
        if (bodyTruncated) contextLines.push('\\n[...truncated...]')
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
          const header = `@${who}${when ? ` (${when})` : ''}:`
          const raw = String(c?.body || '').replace(/\\r\\n/g, '\\n').trim()
          const clipped = raw ? (raw.length > MAX_COMMENT_BODY_CHARS ? raw.slice(0, MAX_COMMENT_BODY_CHARS) : raw) : ''
          const truncated = raw.length > MAX_COMMENT_BODY_CHARS

          lines.push(header)
          if (clipped) lines.push(clipped)
          if (truncated) lines.push('\\n[...truncated...]')
          lines.push('---')

          contextLines.push(header)
          if (clipped) contextLines.push(clipped)
          if (truncated) contextLines.push('\\n[...truncated...]')
          contextLines.push('---')
        }

        lines.push('</issue_comments>')
        contextLines.push('</issue_comments>')
      }

      const imageUrls = Array.isArray(val.imageUrls) ? val.imageUrls.map(u => String(u || '').trim()).filter(Boolean) : []
      if (imageUrls.length > 0) {
        lines.push('')
        lines.push(`Images referenced in issue/comments (${imageUrls.length}):`)
        for (const u of imageUrls.slice(0, 10)) lines.push(`- ${u}`)
        if (imageUrls.length > 10) lines.push('- ...')

        contextLines.push('')
        contextLines.push(`Images referenced in issue/comments (${imageUrls.length}):`)
        for (const u of imageUrls.slice(0, 10)) contextLines.push(`- ${u}`)
        if (imageUrls.length > 10) contextLines.push('- ...')
      }

      lines.push('')
      lines.push('Task:')
      lines.push('- Reproduce the problem (if possible) and identify the root cause.')
      lines.push('- Implement a minimal fix; avoid unrelated refactors.')
      lines.push('- Add tests (or clear validation steps) to verify the fix.')

      suggestedPrompt.value = lines.join('\\n')
      taskContext.value = contextLines.join('\\n').trim()
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
      taskContext: taskContext.value.trim() || undefined,
    }
  }

  function insertTaskCardMessage(task: TaskCardData) {
    const msgId = `msg_${task.id}`
    chatStore.allMessages.push({
      id: msgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      metadata: { taskCard: task },
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
    if (ok) await showNotification(t('common.copy') + ' ' + t('common.success'), 'info')
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

      const attachments: any[] = []
      if (imageUrlsSnapshot.length > 0) {
        try {
          const res = await sendToExtension<{
            success: boolean
            attachments?: Array<{ url: string; name: string; mimeType: string; size: number; data: string }>
          }>('issue.fetchImageAttachments', { urls: imageUrlsSnapshot, maxImages: 5 })

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
              url: a.url,
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
        shouldAttachTaskContext ? { taskContext: taskContextText } : undefined,
      )
    } catch (err) {
      console.error('Failed to start task:', err)
    }
  }

  onBeforeUnmount(() => {
    stopTimers()
  })

  return {
    t,
    chatStore,
    visible,
    issueUrl,
    issue,
    fetchError,
    isFetching,
    isAnalyzing,
    analysisProgress,
    intentSummary,
    suggestedPrompt,
    taskContext,
    promptExpanded,
    canCreate,
    handleOpenIssue,
    handleCopyPrompt,
    handleInsertToChat,
    handleCreate,
    handleStart,
  }
}


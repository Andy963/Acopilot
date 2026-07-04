import { computed, ref, watch } from 'vue'
import { useChatStore } from '../../stores'
import { sendToExtension, showNotification } from '../../utils/vscode'
import { useI18n } from '../../i18n'

interface PinnedFileItem {
  id: string
  path: string
  workspaceUri: string
  enabled: boolean
  addedAt: number
  exists?: boolean
}

interface SkillDefinition {
  id: string
  name: string
  description?: string
  prompt: string
}

export interface PinnedFilesPanelProps {
  visible: boolean
}

export type PinnedFilesPanelEmit = {
  (e: 'close'): void
  (e: 'statsChange', enabledCount: number): void
}

type PinPanelTab = 'files' | 'skill' | 'custom'

function normalizeSkills(raw: unknown): SkillDefinition[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((s): s is any => s && typeof s === 'object')
    .map((s: any) => ({
      id: String(s.id || '').trim(),
      name: String(s.name || '').trim(),
      description: typeof s.description === 'string' ? s.description : '',
      prompt: String(s.prompt || ''),
    }))
    .filter(s => s.id && s.prompt.trim())
}

function slugifySkillName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || `skill-${Date.now()}`
}

function uniqueSkillId(existingSkills: SkillDefinition[], base: string): string {
  if (!existingSkills.some(s => s.id === base)) return base

  let suffix = 2
  while (existingSkills.some(s => s.id === `${base}-${suffix}`)) suffix++
  return `${base}-${suffix}`
}

function getErrorMessageByCode(errorCode?: string, rawMessage?: string): string {
  if (errorCode === 'OUTSIDE_WORKSPACE') return 'File must be inside the workspace'
  if (errorCode === 'FILE_TOO_LARGE') return 'File is too large'
  if (errorCode === 'FILE_NOT_FOUND') return 'File not found'
  return rawMessage || 'Unknown error'
}

export function usePinnedFilesPanel(props: PinnedFilesPanelProps, emit: PinnedFilesPanelEmit) {
  const { t } = useI18n()
  const chatStore = useChatStore()

  const pinnedFiles = ref<PinnedFileItem[]>([])
  const showPinnedFilesPanel = computed(() => props.visible)
  const isLoadingPinnedFiles = ref(false)
  const isDraggingOver = ref(false)

  const pinPanelTab = ref<PinPanelTab>('files')

  const skills = ref<SkillDefinition[]>([])
  const isLoadingSkills = ref(false)
  const selectedSkillId = ref('')
  const customPromptDraft = ref('')
  const isSavingPinnedPrompt = ref(false)
  const saveAsSkillName = ref('')
  const isSavingAsSkill = ref(false)

  const selectedSkill = computed(() => skills.value.find(s => s.id === selectedSkillId.value) || null)

  const hasPinnedPrompt = computed(() => Boolean(chatStore.pinnedPrompt?.mode && chatStore.pinnedPrompt.mode !== 'none'))

  const enabledPinnedFilesCount = computed(() => pinnedFiles.value.filter(f => f.enabled).length)

  async function loadPinnedFiles() {
    isLoadingPinnedFiles.value = true
    try {
      const config = await sendToExtension<{ files: PinnedFileItem[] }>('getPinnedFilesConfig', {})
      if (config?.files) pinnedFiles.value = config.files
    } catch (error: any) {
      console.error('Failed to load pinned files:', error)
      await showNotification(
        t('components.input.notifications.loadFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isLoadingPinnedFiles.value = false
    }
  }

  async function loadSkills() {
    isLoadingSkills.value = true
    try {
      const response = await sendToExtension<{ skills: unknown }>('skills.list', {})
      skills.value = normalizeSkills(response?.skills)
      if (!selectedSkillId.value && skills.value.length > 0) {
        selectedSkillId.value = skills.value[0].id
      }
    } catch (error: any) {
      console.error('Failed to load skills:', error)
      await showNotification(
        t('components.input.notifications.loadSkillsFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isLoadingSkills.value = false
    }
  }

  function syncPinnedPromptDraftFromStore() {
    const pinned = chatStore.pinnedPrompt
    if (pinned?.mode === 'custom' && typeof pinned.customPrompt === 'string') {
      customPromptDraft.value = pinned.customPrompt
    } else {
      customPromptDraft.value = ''
    }

    if (pinned?.mode === 'skill' && typeof pinned.skillId === 'string') {
      selectedSkillId.value = pinned.skillId
    }
  }

  async function checkPinnedFilesExistence() {
    if (pinnedFiles.value.length === 0) return

    try {
      const result = await sendToExtension<{ existsMap: Record<string, boolean> }>('checkPinnedFilesExistence', {})
      const existsMap = result?.existsMap || {}

      pinnedFiles.value = pinnedFiles.value.map((file) => ({
        ...file,
        exists: existsMap[file.id] !== false,
      }))
    } catch (error) {
      console.warn('Failed to check pinned files existence:', error)
    }
  }

  function emitClose() {
    emit('close')
  }

  function emitStats() {
    emit('statsChange', enabledPinnedFilesCount.value)
  }

  async function handleAddPinnedFile() {
    try {
      const result = await sendToExtension<{ success: boolean; file?: PinnedFileItem; error?: string; errorCode?: string }>(
        'addPinnedFileFromDialog',
        {},
      )

      if (result?.success && result.file) {
        pinnedFiles.value.push(result.file)
        await showNotification(t('components.input.notifications.fileAdded', { path: result.file.path }), 'info')
        emitStats()
      } else if (result && !result.success) {
        const msg = getErrorMessageByCode(result.errorCode, result.error)
        await showNotification(msg, 'error')
      }
    } catch (error: any) {
      console.error('Failed to add pinned file:', error)
      await showNotification(
        t('components.input.notifications.addFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    }
  }

  async function handleRemovePinnedFile(id: string) {
    try {
      await sendToExtension('removePinnedFile', { id })
      pinnedFiles.value = pinnedFiles.value.filter(f => f.id !== id)
      emitStats()
    } catch (error: any) {
      console.error('Failed to remove pinned file:', error)
      await showNotification(
        t('components.input.notifications.removeFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    }
  }

  async function handleTogglePinnedFile(id: string, enabled: boolean) {
    try {
      await sendToExtension('setPinnedFileEnabled', { id, enabled })
      const file = pinnedFiles.value.find(f => f.id === id)
      if (file) file.enabled = enabled
    } catch (error: any) {
      console.error('Failed to toggle pinned file:', error)
    }
  }

  async function handleSavePinnedPrompt() {
    isSavingPinnedPrompt.value = true
    try {
      if (pinPanelTab.value === 'skill') {
        const selected = selectedSkill.value
        if (!selected) return

        await chatStore.setPinnedPrompt({
          mode: 'skill',
          skillId: selected.id,
        })
      } else if (pinPanelTab.value === 'custom') {
        const customPrompt = customPromptDraft.value.trim()
        if (!customPrompt) return

        customPromptDraft.value = customPrompt
        await chatStore.setPinnedPrompt({
          mode: 'custom',
          customPrompt,
        })
      }

      await showNotification(t('components.input.notifications.pinnedPromptSaved'), 'info')
    } catch (error: any) {
      console.error('Failed to save pinned prompt:', error)
      await showNotification(
        t('components.input.notifications.savePinnedPromptFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isSavingPinnedPrompt.value = false
    }
  }

  async function handleSaveCustomPromptAsSkill() {
    const prompt = customPromptDraft.value.trim()
    const name = saveAsSkillName.value.trim()
    if (!prompt || !name) return

    isSavingAsSkill.value = true
    try {
      const id = uniqueSkillId(skills.value, slugifySkillName(name))
      const nextSkills = [...skills.value, { id, name, description: '', prompt }]

      await sendToExtension('updateSystemPromptConfig', { config: { skills: nextSkills } })
      skills.value = nextSkills
      saveAsSkillName.value = ''

      selectedSkillId.value = id
      pinPanelTab.value = 'skill'
      await chatStore.setPinnedPrompt({ mode: 'skill', skillId: id })

      await showNotification(t('components.input.notifications.pinnedPromptSaved'), 'info')
    } catch (error: any) {
      console.error('Failed to save custom prompt as skill:', error)
      await showNotification(
        t('components.input.notifications.savePinnedPromptFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isSavingAsSkill.value = false
    }
  }

  async function handleClearPinnedPrompt() {
    isSavingPinnedPrompt.value = true
    try {
      await chatStore.setPinnedPrompt({ mode: 'none' })
      customPromptDraft.value = ''
      await showNotification(t('components.input.notifications.pinnedPromptCleared'), 'info')
    } catch (error: any) {
      console.error('Failed to clear pinned prompt:', error)
      await showNotification(
        t('components.input.notifications.clearPinnedPromptFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isSavingPinnedPrompt.value = false
    }
  }

  function handleSelectSkill(skillId: string) {
    selectedSkillId.value = skillId
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault()
    if (pinPanelTab.value !== 'files') return
    isDraggingOver.value = true
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    if (pinPanelTab.value !== 'files') return
    isDraggingOver.value = true
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault()
    if (pinPanelTab.value !== 'files') return
    isDraggingOver.value = false
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault()
    if (pinPanelTab.value !== 'files') return
    isDraggingOver.value = false

    const files = event.dataTransfer?.files
    if (!files || files.length === 0) {
      await showNotification(t('components.input.notifications.cannotGetFilePath'), 'warning')
      return
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        const validation = await sendToExtension<{
          valid: boolean
          relativePath?: string
          workspaceUri?: string
          error?: string
          errorCode?: string
        }>('validatePinnedFile', { path: file.name })

        if (!validation?.valid) {
          const msg = getErrorMessageByCode(validation?.errorCode, validation?.error)
          await showNotification(msg, 'error')
          continue
        }

        const addResult = await sendToExtension<{
          success: boolean
          file?: PinnedFileItem
          error?: string
          errorCode?: string
        }>('addPinnedFile', { path: validation.relativePath, workspaceUri: validation.workspaceUri })

        if (addResult?.success && addResult.file) {
          pinnedFiles.value.push(addResult.file)
          await showNotification(
            t('components.input.notifications.fileAdded', { path: validation.relativePath }),
            'info',
          )
          emitStats()
        } else if (!addResult?.success) {
          const msg = getErrorMessageByCode(addResult?.errorCode, addResult?.error)
          await showNotification(msg, 'error')
        }
      } catch (error: any) {
        console.error('Failed to add pinned file:', error)
        await showNotification(
          t('components.input.notifications.addFailed', { error: error.message || t('common.unknownError') }),
          'error',
        )
      }
    }
  }

  async function openPanel() {
    syncPinnedPromptDraftFromStore()
    saveAsSkillName.value = ''
    pinPanelTab.value =
      chatStore.pinnedPrompt?.mode === 'skill'
        ? 'skill'
        : chatStore.pinnedPrompt?.mode === 'custom'
          ? 'custom'
          : 'files'

    await loadPinnedFiles()
    await checkPinnedFilesExistence()
    await loadSkills()
    emitStats()
  }

  watch(showPinnedFilesPanel, (visible) => {
    if (visible) void openPanel()
  })

  watch(enabledPinnedFilesCount, () => {
    emitStats()
  })

  watch(pinPanelTab, (tab) => {
    if (tab !== 'files') isDraggingOver.value = false
  })

  return {
    t,
    chatStore,
    pinnedFiles,
    showPinnedFilesPanel,
    isLoadingPinnedFiles,
    isDraggingOver,
    pinPanelTab,
    skills,
    isLoadingSkills,
    selectedSkillId,
    selectedSkill,
    customPromptDraft,
    isSavingPinnedPrompt,
    saveAsSkillName,
    isSavingAsSkill,
    hasPinnedPrompt,
    enabledPinnedFilesCount,
    loadPinnedFiles,
    checkPinnedFilesExistence,
    loadSkills,
    openPanel,
    emitClose,
    handleAddPinnedFile,
    handleRemovePinnedFile,
    handleTogglePinnedFile,
    handleSavePinnedPrompt,
    handleSaveCustomPromptAsSkill,
    handleClearPinnedPrompt,
    handleSelectSkill,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}

import { computed, ref, watch } from 'vue'
import { useChatStore } from '../../stores'
import { sendToExtension, showNotification } from '../../utils/vscode'
import { useI18n } from '../../i18n'
import type { PinnedPromptItem } from '../../stores/chat/types'

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

interface PinnedPromptPreset {
  id: string
  name: string
  prompt: string
  createdAt?: number
  updatedAt?: number
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

function getErrorMessageByCode(errorCode?: string, rawMessage?: string): string {
  if (errorCode === 'OUTSIDE_WORKSPACE') return 'File must be inside the workspace'
  if (errorCode === 'FILE_TOO_LARGE') return 'File is too large'
  if (errorCode === 'FILE_NOT_FOUND') return 'File not found'
  return rawMessage || 'Unknown error'
}

function normalizePinnedPromptPresets(raw: unknown): PinnedPromptPreset[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((preset): preset is any => preset && typeof preset === 'object')
    .map((preset: any) => ({
      id: String(preset.id || '').trim(),
      name: String(preset.name || '').trim(),
      prompt: String(preset.prompt || ''),
      createdAt: typeof preset.createdAt === 'number' ? preset.createdAt : undefined,
      updatedAt: typeof preset.updatedAt === 'number' ? preset.updatedAt : undefined,
    }))
    .filter(preset => preset.id && preset.name && preset.prompt.trim())
}

export function usePinnedFilesPanel(props: PinnedFilesPanelProps, emit: PinnedFilesPanelEmit) {
  const { t } = useI18n()
  const chatStore = useChatStore()

  const pinnedFiles = ref<PinnedFileItem[]>([])
  const showPinnedFilesPanel = computed(() => props.visible)
  const isLoadingPinnedFiles = ref(false)
  const isDraggingOver = ref(false)

  const pinPanelTab = ref<PinPanelTab>('custom')

  const skills = ref<SkillDefinition[]>([])
  const isLoadingSkills = ref(false)
  const selectedSkillId = ref('')
  const presets = ref<PinnedPromptPreset[]>([])
  const isLoadingPresets = ref(false)
  const selectedPresetId = ref('')
  const customPromptDraft = ref('')
  const isSavingPinnedPrompt = ref(false)
  const presetNameDraft = ref('')
  const isSavingPreset = ref(false)

  const selectedSkill = computed(() => skills.value.find(s => s.id === selectedSkillId.value) || null)
  const selectedPreset = computed(() => presets.value.find(preset => preset.id === selectedPresetId.value) || null)

  const activePinnedPrompts = computed(() => Array.isArray(chatStore.pinnedPrompts) ? chatStore.pinnedPrompts : [])
  const hasPinnedPrompt = computed(() => activePinnedPrompts.value.length > 0)

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

  async function loadPinnedPromptPresets() {
    isLoadingPresets.value = true
    try {
      const response = await sendToExtension<{ presets: unknown }>('pinnedPromptPresets.list', {})
      presets.value = normalizePinnedPromptPresets(response?.presets)
      if (selectedPresetId.value) {
        const selected = selectedPreset.value
        if (selected) {
          customPromptDraft.value = selected.prompt
          presetNameDraft.value = selected.name
        }
      }
    } catch (error: any) {
      console.error('Failed to load pinned prompt presets:', error)
      await showNotification(
        t('components.input.notifications.loadPinnedPromptPresetsFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isLoadingPresets.value = false
    }
  }

  function getPrimaryPinnedPrompt(): PinnedPromptItem | null {
    return activePinnedPrompts.value[0] || null
  }

  function syncPinnedPromptDraftFromStore() {
    const pinned = getPrimaryPinnedPrompt()
    if (pinned?.mode === 'custom' && typeof pinned.customPrompt === 'string') {
      customPromptDraft.value = pinned.customPrompt
      selectedPresetId.value = ''
    } else {
      if (pinned?.mode !== 'preset') customPromptDraft.value = ''
    }

    if (pinned?.mode === 'skill' && typeof pinned.skillId === 'string') {
      selectedSkillId.value = pinned.skillId
    }

    if (pinned?.mode === 'preset' && typeof pinned.presetId === 'string') {
      selectedPresetId.value = pinned.presetId
      const selected = presets.value.find(preset => preset.id === pinned.presetId)
      if (selected) {
        customPromptDraft.value = selected.prompt
        presetNameDraft.value = selected.name
      }
    }
  }

  function createPinnedPromptItemFromSelection(): PinnedPromptItem | null {
    const order = activePinnedPrompts.value.length

    if (pinPanelTab.value === 'skill') {
      const selected = selectedSkill.value
      if (!selected) return null
      return {
        id: `skill:${selected.id}`,
        mode: 'skill',
        skillId: selected.id,
        order
      }
    }

    const customPrompt = customPromptDraft.value.trim()
    if (!customPrompt) return null

    const selected = selectedPreset.value
    if (selected && selected.prompt.trim() === customPrompt) {
      return {
        id: `preset:${selected.id}`,
        mode: 'preset',
        presetId: selected.id,
        order
      }
    }

    return {
      id: `custom:${Date.now().toString(36)}`,
      mode: 'custom',
      customPrompt,
      name: presetNameDraft.value.trim() || undefined,
      order
    }
  }

  function normalizePromptOrders(items: PinnedPromptItem[]): PinnedPromptItem[] {
    return items.map((item, index) => ({ ...item, order: index }))
  }

  async function savePinnedPromptItems(items: PinnedPromptItem[]): Promise<void> {
    await chatStore.setPinnedPrompts(normalizePromptOrders(items))
  }

  function upsertPinnedPromptItem(item: PinnedPromptItem): PinnedPromptItem[] {
    const existingIndex = activePinnedPrompts.value.findIndex(existing => existing.id === item.id)
    if (existingIndex >= 0) {
      return activePinnedPrompts.value.map((existing, index) => (
        index === existingIndex ? { ...item, order: existing.order } : existing
      ))
    }
    return [...activePinnedPrompts.value, item]
  }

  function formatPinnedPromptItemTitle(item: PinnedPromptItem): string {
    if (item.mode === 'skill') {
      const skill = skills.value.find(candidate => candidate.id === item.skillId)
      return skill?.name || item.skillId || item.id
    }

    if (item.mode === 'preset') {
      const preset = presets.value.find(candidate => candidate.id === item.presetId)
      return preset?.name || item.presetId || item.id
    }

    if (item.name) return item.name
    const count = typeof item.customPrompt === 'string' ? item.customPrompt.trim().length : 0
    return t('components.input.pinnedFilesPanel.active.customTitle', { count })
  }

  function isSkillPinned(skillId: string): boolean {
    return activePinnedPrompts.value.some(item => item.mode === 'skill' && item.skillId === skillId)
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
      const item = createPinnedPromptItemFromSelection()
      if (!item) return

      if (item.mode === 'custom' && item.customPrompt) {
        customPromptDraft.value = item.customPrompt.trim()
      }
      await savePinnedPromptItems(upsertPinnedPromptItem(item))

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

  async function handleSaveCustomPromptAsPreset() {
    const prompt = customPromptDraft.value.trim()
    const name = presetNameDraft.value.trim()
    if (!prompt || !name) return

    isSavingPreset.value = true
    try {
      const response = await sendToExtension<{ preset: PinnedPromptPreset; presets: unknown }>(
        'pinnedPromptPresets.save',
        {
          preset: {
            id: selectedPresetId.value || undefined,
            name,
            prompt,
          },
        },
      )
      presets.value = normalizePinnedPromptPresets(response?.presets)
      const savedPreset = response?.preset
      if (!savedPreset?.id) return

      selectedPresetId.value = savedPreset.id
      presetNameDraft.value = savedPreset.name
      customPromptDraft.value = savedPreset.prompt
      await savePinnedPromptItems(upsertPinnedPromptItem({
        id: `preset:${savedPreset.id}`,
        mode: 'preset',
        presetId: savedPreset.id,
        order: activePinnedPrompts.value.length
      }))

      await showNotification(t('components.input.notifications.pinnedPromptSaved'), 'info')
    } catch (error: any) {
      console.error('Failed to save custom prompt as preset:', error)
      await showNotification(
        t('components.input.notifications.savePinnedPromptFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isSavingPreset.value = false
    }
  }

  async function handleDeleteSelectedPreset() {
    const presetId = selectedPresetId.value
    if (!presetId || !selectedPreset.value) return

    isSavingPreset.value = true
    try {
      const response = await sendToExtension<{ presets: unknown }>('pinnedPromptPresets.delete', { id: presetId })
      presets.value = normalizePinnedPromptPresets(response?.presets)

      const remaining = activePinnedPrompts.value.filter(
        item => !(item.mode === 'preset' && item.presetId === presetId),
      )
      if (remaining.length !== activePinnedPrompts.value.length) {
        await savePinnedPromptItems(remaining)
      }

      selectedPresetId.value = ''
      presetNameDraft.value = ''
      await showNotification(t('components.input.notifications.pinnedPromptPresetDeleted'), 'info')
    } catch (error: any) {
      console.error('Failed to delete pinned prompt preset:', error)
      await showNotification(
        t('components.input.notifications.deletePinnedPromptPresetFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isSavingPreset.value = false
    }
  }

  async function handleClearPinnedPrompt() {
    isSavingPinnedPrompt.value = true
    try {
      await chatStore.setPinnedPrompts([])
      customPromptDraft.value = ''
      selectedPresetId.value = ''
      presetNameDraft.value = ''
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

  async function handleSelectPreset(presetId: string) {
    selectedPresetId.value = presetId
    const preset = selectedPreset.value
    if (!preset) {
      presetNameDraft.value = ''
      return
    }

    customPromptDraft.value = preset.prompt
    presetNameDraft.value = preset.name
  }

  async function handleRemovePinnedPrompt(id: string) {
    isSavingPinnedPrompt.value = true
    try {
      await savePinnedPromptItems(activePinnedPrompts.value.filter(item => item.id !== id))
      await showNotification(t('components.input.notifications.pinnedPromptSaved'), 'info')
    } catch (error: any) {
      console.error('Failed to remove pinned prompt:', error)
      await showNotification(
        t('components.input.notifications.savePinnedPromptFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isSavingPinnedPrompt.value = false
    }
  }

  async function handleMovePinnedPrompt(id: string, direction: -1 | 1) {
    const index = activePinnedPrompts.value.findIndex(item => item.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= activePinnedPrompts.value.length) return

    const next = [...activePinnedPrompts.value]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)

    isSavingPinnedPrompt.value = true
    try {
      await savePinnedPromptItems(next)
    } catch (error: any) {
      console.error('Failed to move pinned prompt:', error)
      await showNotification(
        t('components.input.notifications.savePinnedPromptFailed', { error: error.message || t('common.unknownError') }),
        'error',
      )
    } finally {
      isSavingPinnedPrompt.value = false
    }
  }

  function handleCustomPromptEdited() {
    const selected = selectedPreset.value
    if (selected && customPromptDraft.value !== selected.prompt) {
      selectedPresetId.value = ''
    }
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
    if (!selectedPresetId.value) presetNameDraft.value = ''
    pinPanelTab.value =
      getPrimaryPinnedPrompt()?.mode === 'skill'
        ? 'skill'
        : 'custom'

    await loadPinnedFiles()
    await checkPinnedFilesExistence()
    await loadSkills()
    await loadPinnedPromptPresets()
    syncPinnedPromptDraftFromStore()
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
    presets,
    isLoadingPresets,
    selectedPresetId,
    selectedPreset,
    activePinnedPrompts,
    customPromptDraft,
    isSavingPinnedPrompt,
    presetNameDraft,
    isSavingPreset,
    hasPinnedPrompt,
    enabledPinnedFilesCount,
    loadPinnedFiles,
    checkPinnedFilesExistence,
    loadSkills,
    loadPinnedPromptPresets,
    openPanel,
    emitClose,
    handleAddPinnedFile,
    handleRemovePinnedFile,
    handleTogglePinnedFile,
    handleSavePinnedPrompt,
    handleSaveCustomPromptAsPreset,
    handleDeleteSelectedPreset,
    handleClearPinnedPrompt,
    handleRemovePinnedPrompt,
    handleMovePinnedPrompt,
    handleSelectSkill,
    handleSelectPreset,
    handleCustomPromptEdited,
    formatPinnedPromptItemTitle,
    isSkillPinned,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}

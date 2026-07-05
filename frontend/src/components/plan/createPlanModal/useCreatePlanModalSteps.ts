import type { Ref } from 'vue'
import { createThumbnail, getFileType, inferMimeType, readFileAsBase64, validateFile } from '../../../utils/file'
import { generateId } from '../../../utils/format'
import type { Attachment } from '../../../types'
import { createEmptyStep, type StepDraft } from './types'

async function createImageAttachment(file: File): Promise<Attachment | null> {
  const validation = validateFile(file)
  if (!validation.valid) return null

  const mimeType = inferMimeType(file.name, file.type)
  const type = getFileType(mimeType)
  if (type !== 'image') return null

  try {
    const data = await readFileAsBase64(file)
    const attachment: Attachment = {
      id: generateId(),
      name: file.name,
      type,
      size: file.size,
      mimeType,
      data,
    }

    try {
      attachment.thumbnail = await createThumbnail(file)
    } catch {
      // ignore thumbnail failure
    }

    return attachment
  } catch (error) {
    console.error('Failed to read attachment file:', error)
    return null
  }
}

function toPastedImageFilename(mimeType: string): string {
  const normalized = String(mimeType || '').toLowerCase().trim()
  let extension = 'png'

  if (normalized === 'image/jpeg') extension = 'jpg'
  else if (normalized === 'image/png') extension = 'png'
  else if (normalized === 'image/gif') extension = 'gif'
  else if (normalized === 'image/webp') extension = 'webp'
  else if (normalized === 'image/bmp') extension = 'bmp'
  else if (normalized.startsWith('image/')) {
    extension = normalized.slice('image/'.length).replace(/[^a-z0-9]/g, '') || 'png'
  }

  return `pasted-image-${generateId()}.${extension}`
}

function normalizePastedImageFile(file: File, mimeTypeHint: string): File {
  const name = (file.name || '').trim()
  const mimeType = inferMimeType(name, file.type || mimeTypeHint || '')

  if (name) return file

  try {
    return new File([file], toPastedImageFilename(mimeType), { type: mimeType })
  } catch {
    return file
  }
}

export function useCreatePlanModalSteps(steps: Ref<StepDraft[]>, stepsContainerRef: Ref<HTMLElement | null>) {
  function addStep() {
    steps.value.push(createEmptyStep())

    requestAnimationFrame(() => {
      const container = stepsContainerRef.value
      if (!container) return

      const lastStep = container.querySelector('.step:last-child') as HTMLElement | null
      if (!lastStep) return

      lastStep.scrollIntoView({ block: 'nearest' })
      const titleInput = lastStep.querySelector('input.step-title') as HTMLInputElement | null
      titleInput?.focus()
    })
  }

  function removeStep(stepId: string) {
    steps.value = steps.value.filter(step => step.id !== stepId)
    if (steps.value.length === 0) {
      steps.value = [createEmptyStep()]
    }
  }

  async function handleAttachStep(stepId: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*'

    input.onchange = async event => {
      const files = Array.from((event.target as HTMLInputElement).files || [])
      if (files.length === 0) return

      const step = steps.value.find(item => item.id === stepId)
      if (!step) return

      for (const file of files) {
        const attachment = await createImageAttachment(file)
        if (attachment) {
          step.attachments.push(attachment)
        }
      }
    }

    input.click()
  }

  async function handlePasteStep(stepId: string, event: ClipboardEvent) {
    const items = event.clipboardData?.items
    if (!items) return

    const step = steps.value.find(item => item.id === stepId)
    if (!step) return

    const candidates: Array<{ file: File; mimeTypeHint: string }> = []
    let hasImage = false

    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      if (item.kind !== 'file') continue

      const file = item.getAsFile()
      if (!file) continue

      const mimeType = inferMimeType(file.name, file.type || item.type || '')
      if (getFileType(mimeType) === 'image') {
        hasImage = true
      }

      candidates.push({ file, mimeTypeHint: item.type })
    }

    if (!hasImage) return

    const plainText = event.clipboardData?.getData('text/plain') || ''
    if (!plainText.trim()) {
      event.preventDefault()
    }

    for (const candidate of candidates) {
      const normalizedFile = normalizePastedImageFile(candidate.file, candidate.mimeTypeHint)
      const attachment = await createImageAttachment(normalizedFile)
      if (attachment) {
        step.attachments.push(attachment)
      }
    }
  }

  function removeStepAttachment(stepId: string, attachmentId: string) {
    const step = steps.value.find(item => item.id === stepId)
    if (!step) return

    step.attachments = step.attachments.filter(attachment => attachment.id !== attachmentId)
  }

  return {
    addStep,
    handleAttachStep,
    handlePasteStep,
    removeStep,
    removeStepAttachment,
  }
}

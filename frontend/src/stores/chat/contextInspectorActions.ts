/**
 * Context Inspector 相关操作
 */

import type { ChatStoreState } from './types'
import type { Attachment, ContextInspectorData } from '../../types'
import { sendToExtension } from '../../utils/vscode'

function normalizeErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const anyErr = error as any
    if (typeof anyErr.message === 'string' && anyErr.message.trim()) return anyErr.message
    if (typeof anyErr.error === 'string' && anyErr.error.trim()) return anyErr.error
  }
  return 'Failed to load context inspector data'
}

export function closeContextInspector(state: ChatStoreState): void {
  state.contextInspectorVisible.value = false
}

export function openContextInspectorWithData(state: ChatStoreState, data: ContextInspectorData): void {
  state.contextInspectorSource.value = 'message'
  state.contextInspectorError.value = null
  state.contextInspectorLoading.value = false
  state.contextInspectorData.value = data
  state.contextInspectorVisible.value = true
}

export async function openContextInspectorPreview(state: ChatStoreState, attachments?: Attachment[]): Promise<void> {
  state.contextInspectorSource.value = 'preview'
  state.contextInspectorError.value = null
  state.contextInspectorLoading.value = true
  state.contextInspectorVisible.value = true

  try {
    const attachmentMeta = Array.isArray(attachments)
      ? attachments.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          size: a.size,
          mimeType: a.mimeType,
          url: a.url
        }))
      : undefined

    const contextOverrides = state.messageContextOverrides.value
    const hasContextOverrides = contextOverrides && Object.keys(contextOverrides).length > 0

    const selectionReferences = state.selectionReferences.value
    const hasSelectionReferences = Array.isArray(selectionReferences) && selectionReferences.length > 0
    const selectionReferencesPayload = hasSelectionReferences
      ? selectionReferences.map((r) => ({ ...r }))
      : undefined
    const contextOverridesPayload = hasContextOverrides ? { ...contextOverrides } : undefined

    const data = await sendToExtension<ContextInspectorData>('getContextInspectorData', {
      conversationId: state.currentConversationId.value || undefined,
      configId: state.configId.value,
      attachments: attachmentMeta,
      selectionReferences: selectionReferencesPayload,
      contextOverrides: contextOverridesPayload
    })
    state.contextInspectorData.value = data || null
  } catch (error) {
    state.contextInspectorData.value = null
    state.contextInspectorError.value = normalizeErrorMessage(error)
  } finally {
    state.contextInspectorLoading.value = false
  }
}

/**
 * Context Inspector 相关操作
 */

import type { ChatStoreState } from './types'
import type { ContextInspectorData } from '../../types'
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

export async function openContextInspectorPreview(state: ChatStoreState): Promise<void> {
  state.contextInspectorSource.value = 'preview'
  state.contextInspectorError.value = null
  state.contextInspectorLoading.value = true
  state.contextInspectorVisible.value = true

  try {
    const data = await sendToExtension<ContextInspectorData>('getContextInspectorData', {
      conversationId: state.currentConversationId.value || undefined,
      configId: state.configId.value
    })
    state.contextInspectorData.value = data || null
  } catch (error) {
    state.contextInspectorData.value = null
    state.contextInspectorError.value = normalizeErrorMessage(error)
  } finally {
    state.contextInspectorLoading.value = false
  }
}


import { sendToExtension } from '../../../utils/vscode'
import type { ChatStoreState } from '../types'
import { PLAN_RUNNER_METADATA_KEY } from './constants'
import { normalizeLoadedPlanRunner } from './normalization'

export async function persistPlanRunnerState(state: ChatStoreState): Promise<void> {
  if (!state.currentConversationId.value) return

  const conversationId = state.currentConversationId.value
  const value = state.planRunner.value ? { ...state.planRunner.value, lastUpdatedAt: Date.now() } : null

  if (state.planRunner.value) {
    state.planRunner.value.lastUpdatedAt = (value as any).lastUpdatedAt
  }

  try {
    await sendToExtension('conversation.setCustomMetadata', {
      conversationId,
      key: PLAN_RUNNER_METADATA_KEY,
      value,
    })
  } catch (err) {
    console.warn('[planRunner] Failed to persist state:', err)
  }
}

export async function loadPlanRunnerState(state: ChatStoreState): Promise<void> {
  if (!state.currentConversationId.value) {
    state.planRunner.value = null
    return
  }

  try {
    const meta = await sendToExtension<any>('conversation.getConversationMetadata', {
      conversationId: state.currentConversationId.value,
    })

    const raw = meta?.custom?.[PLAN_RUNNER_METADATA_KEY]
    state.planRunner.value = normalizeLoadedPlanRunner(raw)

    if (state.planRunner.value) {
      await persistPlanRunnerState(state)
    }
  } catch (err) {
    console.warn('[planRunner] Failed to load state:', err)
    state.planRunner.value = null
  }
}


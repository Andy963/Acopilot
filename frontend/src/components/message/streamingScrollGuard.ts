export type StreamingFollowMode = 'following' | 'paused_user' | 'paused_guard'

export interface StreamingFollowState {
  mode: StreamingFollowMode
  guardEnabled: boolean
}

export function createInitialStreamingFollowState(): StreamingFollowState {
  return { mode: 'following', guardEnabled: true }
}

export function resetForNewStream(): StreamingFollowState {
  return { mode: 'following', guardEnabled: true }
}

export function resetAfterStreamEnd(): StreamingFollowState {
  return { mode: 'following', guardEnabled: true }
}

export function pauseForUserScroll(state: StreamingFollowState): StreamingFollowState {
  if (state.mode !== 'following') return state
  return { ...state, mode: 'paused_user' }
}

export function pauseForGuard(state: StreamingFollowState): StreamingFollowState {
  if (state.mode !== 'following') return state
  return { ...state, mode: 'paused_guard' }
}

export function resumeFollowLatest(state: StreamingFollowState): StreamingFollowState {
  return { ...state, mode: 'following', guardEnabled: false }
}

export function shouldShowJumpToLatest(isStreaming: boolean, state: StreamingFollowState): boolean {
  return isStreaming && state.mode !== 'following'
}

export function computeAnchorClampDelta(options: {
  containerTopPx: number
  anchorTopPx: number
  marginPx: number
}): number {
  const threshold = options.containerTopPx + options.marginPx
  return Math.max(0, threshold - options.anchorTopPx)
}

export function computeGuardAction(
  state: StreamingFollowState,
  clampDeltaPx: number
): { nextState: StreamingFollowState; clampDeltaPx: number } {
  if (state.mode !== 'following') return { nextState: state, clampDeltaPx: 0 }
  if (!state.guardEnabled) return { nextState: state, clampDeltaPx: 0 }
  if (clampDeltaPx <= 0) return { nextState: state, clampDeltaPx: 0 }
  return { nextState: pauseForGuard(state), clampDeltaPx }
}

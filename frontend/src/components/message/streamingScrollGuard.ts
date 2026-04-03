export type StreamingFollowMode = 'following' | 'paused_user'

export interface StreamingFollowState {
  mode: StreamingFollowMode
}

export function createInitialStreamingFollowState(): StreamingFollowState {
  return { mode: 'following' }
}

export function resetForNewStream(): StreamingFollowState {
  return { mode: 'following' }
}

export function resetAfterStreamEnd(): StreamingFollowState {
  return { mode: 'following' }
}

export function pauseForUserScroll(state: StreamingFollowState): StreamingFollowState {
  if (state.mode !== 'following') return state
  return { mode: 'paused_user' }
}

export function resumeFollowLatest(state: StreamingFollowState): StreamingFollowState {
  if (state.mode === 'following') return state
  return { mode: 'following' }
}

export function shouldShowJumpToLatest(isStreaming: boolean, state: StreamingFollowState): boolean {
  return isStreaming && state.mode !== 'following'
}

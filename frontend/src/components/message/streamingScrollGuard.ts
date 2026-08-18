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

/**
 * Decide whether a scroll event represents a genuine user scroll-up that
 * should pause streaming auto-follow.
 *
 * The container is compared against the last programmatic scroll position
 * instead of a timing-sensitive "is this scroll programmatic" flag.
 * Streaming content growth increases scrollHeight but never moves scrollTop
 * and never fires a scroll event, so any upward deviation from the last
 * programmatic scrollTop originates from the user (wheel, keyboard, or
 * scrollbar drag).  This avoids the race where a delayed scroll event from
 * our own scroll-to-bottom is misread as a user scroll and latches the
 * follow state into paused_user.
 */
export function shouldPauseForUserScroll(options: {
  isStreaming: boolean
  mode: StreamingFollowMode
  initialAutoFollowPending?: boolean
  currentScrollTop: number
  lastProgrammaticScrollTop: number
  distanceFromBottomPx: number
  stickyThresholdPx: number
  userScrollUpThresholdPx: number
}): boolean {
  if (!options.isStreaming) return false
  if (options.mode !== 'following') return false
  if (options.initialAutoFollowPending) return false

  const scrolledUpByUser =
    options.currentScrollTop < options.lastProgrammaticScrollTop - options.userScrollUpThresholdPx
  const atBottom = options.distanceFromBottomPx <= options.stickyThresholdPx

  return scrolledUpByUser && !atBottom
}

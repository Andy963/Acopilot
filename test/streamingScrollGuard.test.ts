import { describe, expect, it } from 'vitest'

import {
  computeGuardAction,
  createInitialStreamingFollowState,
  pauseForUserScroll,
  resetForNewStream,
  resetAfterStreamEnd,
  resumeFollowLatest,
  shouldShowJumpToLatest
} from '../frontend/src/components/message/streamingScrollGuard'

describe('streaming scroll guard', () => {
  it('allows streaming to follow by default', () => {
    const state = createInitialStreamingFollowState()
    expect(state).toEqual({ mode: 'following', guardEnabled: true })
    expect(shouldShowJumpToLatest(true, state)).toBe(false)
  })

  it('shows jump-to-latest only after the user manually pauses streaming follow', () => {
    const paused = pauseForUserScroll(createInitialStreamingFollowState())
    expect(paused).toEqual({ mode: 'paused_user', guardEnabled: true })
    expect(shouldShowJumpToLatest(true, paused)).toBe(true)
    expect(shouldShowJumpToLatest(false, paused)).toBe(false)
  })

  it('resumes following when jump-to-latest is triggered', () => {
    const resumed = resumeFollowLatest(pauseForUserScroll(createInitialStreamingFollowState()))
    expect(resumed).toEqual({ mode: 'following', guardEnabled: false })
  })

  it('resets to following when a new stream starts or ends', () => {
    const paused = pauseForUserScroll(createInitialStreamingFollowState())
    expect(resetForNewStream()).toEqual({ mode: 'following', guardEnabled: true })
    expect(resetAfterStreamEnd()).toEqual({ mode: 'following', guardEnabled: true })
    expect(resumeFollowLatest(paused)).toEqual({ mode: 'following', guardEnabled: false })
  })

  it('disables guard clamping after jump-to-latest until the next stream reset', () => {
    const resumed = resumeFollowLatest(createInitialStreamingFollowState())
    expect(computeGuardAction(resumed, 24)).toEqual({
      nextState: { mode: 'following', guardEnabled: false },
      clampDeltaPx: 0
    })
    expect(computeGuardAction(resetForNewStream(), 24)).toEqual({
      nextState: { mode: 'paused_guard', guardEnabled: true },
      clampDeltaPx: 24
    })
  })
})

import { describe, expect, it } from 'vitest'

import {
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
    expect(state).toEqual({ mode: 'following' })
    expect(shouldShowJumpToLatest(true, state)).toBe(false)
  })

  it('shows jump-to-latest only after the user manually pauses streaming follow', () => {
    const paused = pauseForUserScroll(createInitialStreamingFollowState())
    expect(paused).toEqual({ mode: 'paused_user' })
    expect(shouldShowJumpToLatest(true, paused)).toBe(true)
    expect(shouldShowJumpToLatest(false, paused)).toBe(false)
  })

  it('resumes following when jump-to-latest is triggered', () => {
    const resumed = resumeFollowLatest(pauseForUserScroll(createInitialStreamingFollowState()))
    expect(resumed).toEqual({ mode: 'following' })
  })

  it('resets to following when a new stream starts or ends', () => {
    const paused = pauseForUserScroll(createInitialStreamingFollowState())
    expect(resetForNewStream()).toEqual({ mode: 'following' })
    expect(resetAfterStreamEnd()).toEqual({ mode: 'following' })
    expect(resumeFollowLatest(paused)).toEqual({ mode: 'following' })
  })
})

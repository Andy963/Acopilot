import { describe, expect, it } from 'vitest'

import {
  computeGuardAction,
  createInitialStreamingFollowState,
  pauseForUserScroll,
  resetForNewStream,
  resetAfterStreamEnd,
  resumeFollowLatest,
  shouldPauseForUserScroll,
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

describe('shouldPauseForUserScroll', () => {
  const base = { stickyThresholdPx: 50, userScrollUpThresholdPx: 8 }

  it('does not pause while streaming content grows without a user scroll', () => {
    // scrollTop stays at the last programmatic position; scrollHeight grew,
    // so we are away from the bottom - but this must NOT pause following.
    expect(
      shouldPauseForUserScroll({
        isStreaming: true,
        mode: 'following',
        currentScrollTop: 1000,
        lastProgrammaticScrollTop: 1000,
        distanceFromBottomPx: 400,
        ...base
      })
    ).toBe(false)
  })

  it('pauses when the user scrolls up beyond the threshold and away from bottom', () => {
    expect(
      shouldPauseForUserScroll({
        isStreaming: true,
        mode: 'following',
        currentScrollTop: 820,
        lastProgrammaticScrollTop: 1000,
        distanceFromBottomPx: 200,
        ...base
      })
    ).toBe(true)
  })

  it('ignores tiny upward jitter within the threshold', () => {
    expect(
      shouldPauseForUserScroll({
        isStreaming: true,
        mode: 'following',
        currentScrollTop: 996,
        lastProgrammaticScrollTop: 1000,
        distanceFromBottomPx: 200,
        ...base
      })
    ).toBe(false)
  })

  it('does not pause when the user is still effectively at the bottom', () => {
    expect(
      shouldPauseForUserScroll({
        isStreaming: true,
        mode: 'following',
        currentScrollTop: 960,
        lastProgrammaticScrollTop: 1000,
        distanceFromBottomPx: 40,
        ...base
      })
    ).toBe(false)
  })

  it('does not pause when not streaming or already paused', () => {
    expect(
      shouldPauseForUserScroll({
        isStreaming: false,
        mode: 'following',
        currentScrollTop: 500,
        lastProgrammaticScrollTop: 1000,
        distanceFromBottomPx: 400,
        ...base
      })
    ).toBe(false)
    expect(
      shouldPauseForUserScroll({
        isStreaming: true,
        mode: 'paused_user',
        currentScrollTop: 500,
        lastProgrammaticScrollTop: 1000,
        distanceFromBottomPx: 400,
        ...base
      })
    ).toBe(false)
    expect(
      shouldPauseForUserScroll({
        isStreaming: true,
        mode: 'paused_guard',
        currentScrollTop: 500,
        lastProgrammaticScrollTop: 1000,
        distanceFromBottomPx: 400,
        ...base
      })
    ).toBe(false)
  })
})

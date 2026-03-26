import { describe, expect, it } from 'vitest'

import {
  computeAnchorClampDelta,
  computeGuardAction,
  createInitialStreamingFollowState,
  resetForNewStream,
  resumeFollowLatest
} from '../frontend/src/components/message/streamingScrollGuard'

describe('streaming scroll guard', () => {
  it('computes a clamp delta only when the anchor is above the visible threshold', () => {
    expect(
      computeAnchorClampDelta({
        containerTopPx: 100,
        anchorTopPx: 120,
        marginPx: 8
      })
    ).toBe(0)

    expect(
      computeAnchorClampDelta({
        containerTopPx: 100,
        anchorTopPx: 90,
        marginPx: 8
      })
    ).toBe(18)
  })

  it('pauses following when guard is enabled and clamp is needed', () => {
    const state = createInitialStreamingFollowState()
    const result = computeGuardAction(state, 12)
    expect(result.clampDeltaPx).toBe(12)
    expect(result.nextState.mode).toBe('paused_guard')
  })

  it('does not guard when follow-latest is explicitly resumed', () => {
    const state = resumeFollowLatest(createInitialStreamingFollowState())
    const result = computeGuardAction(state, 12)
    expect(result.clampDeltaPx).toBe(0)
    expect(result.nextState.mode).toBe('following')
  })

  it('resets to guarded following on new stream', () => {
    const state = resumeFollowLatest(createInitialStreamingFollowState())
    const reset = resetForNewStream()
    expect(state.guardEnabled).toBe(false)
    expect(reset.guardEnabled).toBe(true)
    expect(reset.mode).toBe('following')
  })
})


import { describe, expect, it } from 'vitest'

/**
 * Unit tests for the loadMore / handleScroll interaction in
 * useMessageListScroll.  We replicate the core logic with plain
 * objects (no Vue dependency) to verify the scroll guard invariants.
 */

const VISIBLE_INCREMENT = 40
const LOAD_MORE_THRESHOLD = 100

interface MockContainer {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

function createScrollLogic() {
  let visibleCount = VISIBLE_INCREMENT
  let isLoadingMore = false
  let hasMore = true
  const rafCallbacks: Array<() => void> = []

  const container: MockContainer = {
    scrollHeight: 2000,
    scrollTop: 50,
    clientHeight: 600
  }

  function mockRaf(cb: () => void) {
    rafCallbacks.push(cb)
  }

  function flushRaf() {
    while (rafCallbacks.length > 0) {
      rafCallbacks.shift()!()
    }
  }

  function loadMore() {
    if (isLoadingMore || !hasMore) return

    isLoadingMore = true
    const oldScrollHeight = container.scrollHeight
    const oldScrollTop = container.scrollTop

    visibleCount += VISIBLE_INCREMENT

    // Simulate DOM update: new items increase scrollHeight
    const addedHeight = VISIBLE_INCREMENT * 40
    container.scrollHeight = oldScrollHeight + addedHeight
    container.scrollTop = oldScrollTop + (container.scrollHeight - oldScrollHeight)

    // Simulate browser firing a scroll event synchronously after scrollTop assignment
    handleScroll()

    // Defer clearing the flag (mirrors requestAnimationFrame in real code)
    mockRaf(() => {
      isLoadingMore = false
    })
  }

  function handleScroll() {
    if (hasMore && !isLoadingMore && container.scrollTop < LOAD_MORE_THRESHOLD) {
      loadMore()
    }
  }

  return {
    get visibleCount() { return visibleCount },
    get isLoadingMore() { return isLoadingMore },
    set setHasMore(v: boolean) { hasMore = v },
    container,
    loadMore,
    handleScroll,
    flushRaf
  }
}

describe('loadMore scroll guard', () => {
  it('does not re-trigger loadMore from scroll events during loading', () => {
    const s = createScrollLogic()
    s.container.scrollTop = 30

    s.loadMore()

    // isLoadingMore should still be true (rAF not flushed)
    expect(s.isLoadingMore).toBe(true)
    // visibleCount increased exactly once
    expect(s.visibleCount).toBe(VISIBLE_INCREMENT * 2)

    // Another scroll event while rAF hasn't fired
    s.container.scrollTop = 10
    s.handleScroll()

    // Should NOT have loaded more
    expect(s.visibleCount).toBe(VISIBLE_INCREMENT * 2)

    // After rAF, flag clears
    s.flushRaf()
    expect(s.isLoadingMore).toBe(false)
  })

  it('allows loadMore again after rAF clears the flag', () => {
    const s = createScrollLogic()
    s.container.scrollTop = 30

    s.loadMore()
    s.flushRaf()
    expect(s.isLoadingMore).toBe(false)

    // Scrolling to top should trigger another load
    s.container.scrollTop = 20
    s.handleScroll()
    expect(s.visibleCount).toBe(VISIBLE_INCREMENT * 3)
  })

  it('does not load when scrollTop is above threshold', () => {
    const s = createScrollLogic()
    s.container.scrollTop = 200

    s.handleScroll()
    expect(s.visibleCount).toBe(VISIBLE_INCREMENT)
    expect(s.isLoadingMore).toBe(false)
  })

  it('restores scroll position without hardcoded minimum', () => {
    const s = createScrollLogic()
    s.container.scrollTop = 5
    s.container.scrollHeight = 800

    const oldScrollTop = s.container.scrollTop
    s.loadMore()

    // scrollTop restored relative to new content, not clamped to an arbitrary value
    const addedHeight = VISIBLE_INCREMENT * 40
    const expectedScrollTop = oldScrollTop + addedHeight
    expect(s.container.scrollTop).toBe(expectedScrollTop)
  })
})

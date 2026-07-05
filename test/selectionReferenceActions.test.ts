import { describe, expect, it } from 'vitest'

import { addSelectionReference } from '../frontend/src/stores/chat/selectionReferenceActions'
import type { ChatStoreState, SelectionReference } from '../frontend/src/stores/chat/types'

function createState(initial: SelectionReference[] = []): ChatStoreState {
  return {
    selectionReferences: { value: initial }
  } as unknown as ChatStoreState
}

describe('selection reference actions', () => {
  it('dedupes repeated injections for the same target and keeps the latest payload', async () => {
    const state = createState()

    await addSelectionReference(state, {
      id: 'first',
      uri: 'file:///workspace/extension.ts',
      path: 'extension.ts',
      startLine: 1,
      endLine: 10,
      languageId: 'typescript',
      text: 'const before = true;',
      createdAt: 1
    })

    await addSelectionReference(state, {
      id: 'second',
      uri: 'file:///workspace/extension.ts',
      path: 'extension.ts',
      startLine: 1,
      endLine: 10,
      languageId: 'typescript',
      text: 'const after = true;',
      createdAt: 2
    })

    expect(state.selectionReferences.value).toHaveLength(1)
    expect(state.selectionReferences.value[0]).toMatchObject({
      id: 'second',
      text: 'const after = true;',
      createdAt: 2
    })
  })

  it('keeps distinct targets as separate references', async () => {
    const state = createState()

    await addSelectionReference(state, {
      uri: 'file:///workspace/extension.ts',
      path: 'extension.ts',
      startLine: 1,
      endLine: 10,
      languageId: 'typescript',
      text: 'const example = 1;'
    })

    await addSelectionReference(state, {
      uri: 'file:///workspace/extension.ts',
      path: 'extension.ts',
      startLine: 20,
      endLine: 30,
      languageId: 'typescript',
      text: 'const example = 2;'
    })

    expect(state.selectionReferences.value).toHaveLength(2)
    expect(state.selectionReferences.value.map((item) => [item.startLine, item.endLine])).toEqual([
      [20, 30],
      [1, 10]
    ])
  })
})

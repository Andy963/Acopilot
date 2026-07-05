import { describe, expect, it } from 'vitest'
import {
  ACOPILOT_VIEW_CONTAINER_COMMAND,
  ACOPILOT_VIEW_FOCUS_COMMAND
} from '../webview/viewEntry'

describe('Acopilot navigation command ids', () => {
  it('keeps the activity bar container and webview focus commands aligned', () => {
    expect(ACOPILOT_VIEW_CONTAINER_COMMAND).toBe('workbench.view.extension.acopilot')
    expect(ACOPILOT_VIEW_FOCUS_COMMAND).toBe('acopilot.chatView.focus')
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  ACOPILOT_VIEW_CONTAINER_COMMAND,
  ACOPILOT_VIEW_FOCUS_COMMAND,
  revealAcopilotView,
  revealAcopilotViewAndSendCommand
} from '../webview/viewEntry'

describe('Acopilot view entry helpers', () => {
  it('reveals the activity bar container before focusing the chat view', async () => {
    const executeCommand = vi.fn().mockResolvedValue(undefined)

    await revealAcopilotView(executeCommand)

    expect(executeCommand.mock.calls).toEqual([
      [ACOPILOT_VIEW_CONTAINER_COMMAND],
      [ACOPILOT_VIEW_FOCUS_COMMAND]
    ])
  })

  it('sends the frontend command only after reveal completes', async () => {
    const executeCommand = vi.fn().mockResolvedValue(undefined)
    const sendCommand = vi.fn()
    const payload = { tab: 'tools' }

    await revealAcopilotViewAndSendCommand(executeCommand, sendCommand, 'showSettings', payload)

    expect(executeCommand.mock.calls).toEqual([
      [ACOPILOT_VIEW_CONTAINER_COMMAND],
      [ACOPILOT_VIEW_FOCUS_COMMAND]
    ])
    expect(sendCommand).toHaveBeenCalledWith('showSettings', payload)
    expect(sendCommand.mock.invocationCallOrder[0]).toBeGreaterThan(executeCommand.mock.invocationCallOrder[1])
  })
})

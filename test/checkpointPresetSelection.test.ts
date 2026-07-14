import { describe, expect, it } from 'vitest'
import { resolveCheckpointPreset } from '../frontend/src/components/settings/checkpoint/useCheckpointSettingsConfig'
import type { CheckpointConfig } from '../frontend/src/components/settings/checkpoint/types'

const mutatingTools = [
  'apply_diff',
  'write_file',
  'delete_file',
  'create_directory',
  'execute_command',
  'replace_in_files',
  'generate_image',
]

const dangerousTools = [
  'apply_diff',
  'delete_file',
  'execute_command',
  'replace_in_files',
]

function createConfig(overrides: Partial<CheckpointConfig> = {}): CheckpointConfig {
  return {
    enabled: true,
    beforeTools: [],
    afterTools: [],
    messageCheckpoint: {
      beforeMessages: ['user'],
      afterMessages: [],
      modelOuterLayerOnly: true,
      mergeUnchangedCheckpoints: true,
    },
    maxCheckpoints: -1,
    ...overrides,
  }
}

describe('resolveCheckpointPreset', () => {
  it.each([
    ['safe', mutatingTools, mutatingTools],
    ['light', mutatingTools, []],
    ['dangerous', dangerousTools, dangerousTools],
  ] as const)('matches the %s preset', (preset, beforeTools, afterTools) => {
    const config = createConfig({
      beforeTools: [...beforeTools].reverse(),
      afterTools: [...afterTools].reverse(),
    })

    expect(resolveCheckpointPreset(config)).toBe(preset)
  })

  it('matches the off preset whenever checkpoints are disabled', () => {
    expect(resolveCheckpointPreset(createConfig({ enabled: false }))).toBe('off')
  })

  it('does not select a preset for a customized configuration', () => {
    expect(resolveCheckpointPreset(createConfig({
      beforeTools: ['write_file'],
      afterTools: [],
    }))).toBeNull()
  })
})

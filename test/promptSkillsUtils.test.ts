import { describe, expect, it } from 'vitest'
import { mergeInstalledSkills, upsertSkill } from '../frontend/src/components/settings/prompt/promptSkillsUtils'
import type { SkillDefinition } from '../frontend/src/components/settings/prompt/types'

function createSkill(id: string, name = id, description = '', prompt = `Prompt for ${id}`): SkillDefinition {
  return {
    id,
    name,
    description,
    prompt
  }
}

describe('prompt skills utils', () => {
  it('adds new skills and keeps them sorted by display name', () => {
    const currentSkills = [
      createSkill('beta', 'Beta'),
      createSkill('gamma', 'Gamma')
    ]

    expect(upsertSkill(currentSkills, createSkill('alpha', 'Alpha'))).toEqual([
      createSkill('alpha', 'Alpha'),
      createSkill('beta', 'Beta'),
      createSkill('gamma', 'Gamma')
    ])
  })

  it('replaces an edited skill by original id before sorting', () => {
    const currentSkills = [
      createSkill('alpha', 'Alpha'),
      createSkill('beta', 'Beta')
    ]

    expect(upsertSkill(currentSkills, createSkill('delta', 'Delta'), 'beta')).toEqual([
      createSkill('alpha', 'Alpha'),
      createSkill('delta', 'Delta')
    ])
  })

  it('merges installed skills by id and prefers the installed definition', () => {
    const currentSkills = [
      createSkill('alpha', 'Alpha', '', 'Original alpha'),
      createSkill('gamma', 'Gamma')
    ]
    const installedSkills = [
      createSkill('beta', 'Beta'),
      createSkill('alpha', 'Alpha', 'Updated', 'Installed alpha')
    ]

    expect(mergeInstalledSkills(currentSkills, installedSkills)).toEqual([
      createSkill('alpha', 'Alpha', 'Updated', 'Installed alpha'),
      createSkill('beta', 'Beta'),
      createSkill('gamma', 'Gamma')
    ])
  })
})

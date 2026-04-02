import { normalizeSkills, sortSkills } from './types'
import type { SkillDefinition } from './types'

export function upsertSkill(
  currentSkills: SkillDefinition[],
  nextSkill: SkillDefinition,
  originalId?: string | null
): SkillDefinition[] {
  const skills = normalizeSkills(currentSkills)
  const normalizedSkill = normalizeSkills([nextSkill])[0]

  if (!normalizedSkill) {
    return sortSkills(skills)
  }

  const targetId = originalId || normalizedSkill.id
  const index = skills.findIndex(skill => skill.id === targetId)

  if (index === -1) {
    skills.push(normalizedSkill)
  } else {
    skills[index] = normalizedSkill
  }

  return sortSkills(skills)
}

export function mergeInstalledSkills(
  currentSkills: SkillDefinition[],
  installedSkills: SkillDefinition[]
): SkillDefinition[] {
  return sortSkills(
    [...normalizeSkills(currentSkills), ...normalizeSkills(installedSkills)].reduce<SkillDefinition[]>((acc, skill) => {
      const index = acc.findIndex(item => item.id === skill.id)
      if (index === -1) {
        acc.push(skill)
      } else {
        acc[index] = skill
      }
      return acc
    }, [])
  )
}

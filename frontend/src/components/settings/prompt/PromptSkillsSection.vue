<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ConfirmDialog } from '@/components/common'
import { useI18n } from '@/i18n'
import { sendToExtension, showNotification } from '@/utils/vscode'
import PromptSkillEditorModal from './PromptSkillEditorModal.vue'
import PromptSkillInstallModal from './PromptSkillInstallModal.vue'
import PromptSkillsList from './PromptSkillsList.vue'
import { mergeInstalledSkills, upsertSkill } from './promptSkillsUtils'
import { normalizeSkills, sortSkills } from './types'
import type { InstallSkillsFromUrlResult, SkillDefinition } from './types'

const { t } = useI18n()

const props = defineProps<{
  skills: SkillDefinition[]
}>()

const emit = defineEmits<{
  'update:skills': [skills: SkillDefinition[]]
}>()

const skills = ref<SkillDefinition[]>([])
const isSavingSkills = ref(false)
const skillsMessage = ref('')
const skillsMessageVariant = ref<'success' | 'error' | ''>('')
let skillsMessageTimer: ReturnType<typeof setTimeout> | null = null

const showSkillModal = ref(false)
const editingSkill = ref<SkillDefinition | null>(null)

const showDeleteSkillConfirm = ref(false)
const pendingDeleteSkillId = ref<string | null>(null)
const showInstallSkillModal = ref(false)
const isInstallingSkill = ref(false)
const installSkillError = ref('')

watch(
  () => props.skills,
  (nextSkills) => {
    skills.value = sortSkills(normalizeSkills(nextSkills))
  },
  { immediate: true }
)

function updateSkills(nextSkills: SkillDefinition[]) {
  const normalized = sortSkills(normalizeSkills(nextSkills))
  skills.value = normalized
  emit('update:skills', normalized)
}

function clearSkillsMessage() {
  skillsMessage.value = ''
  skillsMessageVariant.value = ''
}

function setSkillsMessage(message: string, variant: 'success' | 'error') {
  if (skillsMessageTimer) {
    clearTimeout(skillsMessageTimer)
    skillsMessageTimer = null
  }

  skillsMessage.value = message
  skillsMessageVariant.value = variant

  if (variant === 'success') {
    skillsMessageTimer = setTimeout(() => {
      clearSkillsMessage()
      skillsMessageTimer = null
    }, 2000)
  }
}

async function persistSkills(nextSkills: SkillDefinition[]) {
  isSavingSkills.value = true
  clearSkillsMessage()

  try {
    await sendToExtension('updateSystemPromptConfig', {
      config: { skills: nextSkills }
    })
    updateSkills(nextSkills)
    setSkillsMessage(t('components.settings.promptSettings.skills.saveSuccess'), 'success')
  } catch (error) {
    console.error('Failed to save skills:', error)
    setSkillsMessage(t('components.settings.promptSettings.skills.saveFailed'), 'error')
  } finally {
    isSavingSkills.value = false
  }
}

function openAddSkill() {
  editingSkill.value = null
  showSkillModal.value = true
}

function openEditSkill(skill: SkillDefinition) {
  editingSkill.value = skill
  showSkillModal.value = true
}

async function saveSkill(payload: { originalId: string | null; skill: SkillDefinition }) {
  showSkillModal.value = false
  await persistSkills(upsertSkill(skills.value, payload.skill, payload.originalId))
}

function requestDeleteSkill(id: string) {
  pendingDeleteSkillId.value = id
  showDeleteSkillConfirm.value = true
}

async function confirmDeleteSkill() {
  if (!pendingDeleteSkillId.value) return
  const nextSkills = skills.value.filter(skill => skill.id !== pendingDeleteSkillId.value)
  pendingDeleteSkillId.value = null
  await persistSkills(nextSkills)
}

function openInstallSkill() {
  installSkillError.value = ''
  showInstallSkillModal.value = true
}

async function confirmInstallSkill(urlInput: string) {
  const url = urlInput.trim()
  if (!url) {
    installSkillError.value = t('components.settings.promptSettings.skills.installFromUrl.validation.urlRequired')
    return
  }

  isInstallingSkill.value = true
  installSkillError.value = ''

  try {
    const result = await sendToExtension<InstallSkillsFromUrlResult>('installSkillFromUrl', { url })
    const summary = result?.summary
    const returnedSkills = normalizeSkills(result?.skills)

    if (!summary) {
      if (returnedSkills.length === 0) {
        installSkillError.value = t('components.settings.promptSettings.skills.installFromUrl.validation.noSkillsFound')
        return
      }

      showInstallSkillModal.value = false
      await persistSkills(mergeInstalledSkills(skills.value, returnedSkills))
      await showNotification(
        t('components.settings.promptSettings.skills.installFromUrl.notifications.installSuccess', { count: returnedSkills.length }),
        'info'
      )
      return
    }

    if (summary.found === 0) {
      installSkillError.value = t('components.settings.promptSettings.skills.installFromUrl.validation.noSkillsFound')
      return
    }

    if (returnedSkills.length > 0) {
      await persistSkills(mergeInstalledSkills(skills.value, returnedSkills))
    }

    showInstallSkillModal.value = false

    if (summary.installed > 0) {
      await showNotification(
        t('components.settings.promptSettings.skills.installFromUrl.notifications.installSuccess', { count: summary.installed }),
        'info'
      )
    } else if (summary.skippedExisting > 0) {
      await showNotification(
        t('components.settings.promptSettings.skills.installFromUrl.notifications.noNewSkills', { count: summary.skippedExisting }),
        'info'
      )
    }

    if (summary.invalid > 0) {
      await showNotification(
        t('components.settings.promptSettings.skills.installFromUrl.notifications.partialInvalid', { count: summary.invalid }),
        'warning'
      )
    }
  } catch (error: any) {
    const message = error?.message || ''
    if (message === 'NO_SKILLS_DIR') {
      installSkillError.value = t('components.settings.promptSettings.skills.installFromUrl.validation.noSkillsFound')
    } else if (message === 'NO_VALID_SKILLS') {
      installSkillError.value = t('components.settings.promptSettings.skills.installFromUrl.validation.noValidSkillsFound')
    } else {
      installSkillError.value = message || t('components.settings.promptSettings.skills.installFromUrl.installFailed')
    }
  } finally {
    isInstallingSkill.value = false
  }
}

onBeforeUnmount(() => {
  if (skillsMessageTimer) {
    clearTimeout(skillsMessageTimer)
  }
})
</script>

<template>
  <PromptSkillsList
    :skills="skills"
    :is-saving="isSavingSkills"
    :is-installing="isInstallingSkill"
    :message="skillsMessage"
    :message-variant="skillsMessageVariant"
    @add="openAddSkill"
    @install="openInstallSkill"
    @edit="openEditSkill"
    @delete="requestDeleteSkill"
  />

  <PromptSkillEditorModal
    v-model="showSkillModal"
    :skill="editingSkill"
    :existing-skills="skills"
    :is-saving="isSavingSkills"
    @save="saveSkill"
  />

  <ConfirmDialog
    v-model="showDeleteSkillConfirm"
    :title="t('components.settings.promptSettings.skills.delete.title')"
    :message="t('components.settings.promptSettings.skills.delete.message')"
    :confirm-text="t('common.delete')"
    :cancel-text="t('common.cancel')"
    :is-danger="true"
    @confirm="confirmDeleteSkill"
    @cancel="pendingDeleteSkillId = null"
  />

  <PromptSkillInstallModal
    v-model="showInstallSkillModal"
    :is-installing="isInstallingSkill"
    :error="installSkillError"
    @install="confirmInstallSkill"
  />
</template>

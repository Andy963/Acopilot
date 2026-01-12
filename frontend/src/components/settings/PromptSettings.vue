<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { sendToExtension } from '@/utils/vscode'
import { Modal, ConfirmDialog } from '@/components/common'
import { useI18n } from '@/i18n'

const { t } = useI18n()

// 渠道类型
type ChannelType = 'gemini' | 'openai' | 'anthropic'

// 提示词模块定义
interface PromptModule {
  id: string
  name: string
  description: string
  example?: string
  requiresConfig?: string
}

// 系统提示词配置（功能始终启用，不可关闭）
interface SystemPromptConfig {
  template: string
  customPrefix: string
  customSuffix: string
  skills?: SkillDefinition[]
}

// Skill 定义
interface SkillDefinition {
  id: string
  name: string
  description?: string
  prompt: string
}

// 可用的提示词变量列表
const AVAILABLE_PROMPT_MODULES: PromptModule[] = [
  {
    id: 'ENVIRONMENT',
    name: '环境信息',
    description: '包含工作区路径、操作系统、当前时间和时区信息',
    example: `====

ENVIRONMENT

Current Workspace: /path/to/project
Operating System: Windows 11
Current Time: 2024-01-01T12:00:00.000Z
Timezone: Asia/Shanghai
User Language: zh-CN
Please respond using the user's language by default.`
  },
  {
    id: 'WORKSPACE_FILES',
    name: '工作区文件树',
    description: '列出工作区中的文件和目录结构，受上下文感知设置中的深度和忽略模式影响',
    example: `====

WORKSPACE FILES

The following is a list of files in the current workspace:

src/
  main.ts
  utils/
    helper.ts`,
    requiresConfig: '上下文感知 > 发送工作区文件树'
  },
  {
    id: 'OPEN_TABS',
    name: '打开的标签页',
    description: '列出当前在编辑器中打开的文件标签页',
    example: `====

OPEN TABS

Currently open files in editor:
  - src/main.ts
  - src/utils/helper.ts`,
    requiresConfig: '上下文感知 > 发送打开的标签页'
  },
  {
    id: 'ACTIVE_EDITOR',
    name: '活动编辑器',
    description: '显示当前正在编辑的文件路径',
    example: `====

ACTIVE EDITOR

Currently active file: src/main.ts`,
    requiresConfig: '上下文感知 > 发送当前活动编辑器'
  },
  {
    id: 'DIAGNOSTICS',
    name: '诊断信息',
    description: '显示工作区的错误、警告等诊断信息，帮助 AI 修复代码问题',
    example: `====

DIAGNOSTICS

The following diagnostics were found in the workspace:

src/main.ts:
  Line 10: [Error] Cannot find name 'foo'. (ts)
  Line 15: [Warning] 'bar' is defined but never used. (ts)`,
    requiresConfig: '上下文感知 > 启用诊断信息'
  },
  {
    id: 'PINNED_FILES',
    name: '固定文件内容',
    description: '显示用户固定的文件的完整内容',
    example: `====

PINNED FILES CONTENT

The following are pinned files...

--- README.md ---
# Project Title
...`,
    requiresConfig: '需要在输入框旁的固定文件按钮中添加文件'
  },
  {
    id: 'TOOLS',
    name: '工具定义',
    description: '根据渠道配置生成 XML 或 Function Call 格式的工具定义（此变量由系统自动填充）',
    example: `====

TOOLS

You have access to these tools:

## read_file
Description: Read file content
...`
  },
  {
    id: 'MCP_TOOLS',
    name: 'MCP 工具',
    description: '来自 MCP 服务器的额外工具定义（此变量由系统自动填充）',
    example: `====

MCP TOOLS

Additional tools from MCP servers:
...`,
    requiresConfig: 'MCP 设置中需要配置并连接服务器'
  }
]

// 默认模板（使用 {{$xxx}} 格式引用变量）
const DEFAULT_TEMPLATE = `You are a professional programming assistant, proficient in multiple programming languages and frameworks.

{{$ENVIRONMENT}}

{{$WORKSPACE_FILES}}

{{$OPEN_TABS}}

{{$ACTIVE_EDITOR}}

{{$DIAGNOSTICS}}

{{$PINNED_FILES}}

{{$TOOLS}}

{{$MCP_TOOLS}}

====

GUIDELINES

- Use the provided tools to complete tasks. Tools can help you read files, search code, execute commands, and modify files.
- **IMPORTANT: Avoid duplicate tool calls.** Each tool should only be called once with the same parameters. Never repeat the same tool call multiple times.
- When you need to understand the codebase, use read_file to examine specific files or search_in_files to find relevant code patterns.
- When you need to make changes, use apply_diff for targeted modifications or write_to_file for creating new files.
- If the task is simple and doesn't require tools, just respond directly without calling any tools.
- Always maintain code readability and maintainability.
- Do not omit any code.`

// 配置状态
const config = reactive<SystemPromptConfig>({
  template: DEFAULT_TEMPLATE,
  customPrefix: '',
  customSuffix: ''
})

// 原始配置（用于检测变化）
const originalConfig = ref<SystemPromptConfig | null>(null)

// 是否有未保存的变化
const hasChanges = computed(() => {
  if (!originalConfig.value) return false
  return config.template !== originalConfig.value.template ||
         config.customPrefix !== originalConfig.value.customPrefix ||
         config.customSuffix !== originalConfig.value.customSuffix
})

// 加载状态
const isLoading = ref(true)
const isSaving = ref(false)
const saveMessage = ref('')

// Token 计数状态
const tokenCount = ref<number | null>(null)
const isCountingTokens = ref(false)
const tokenCountError = ref('')
const selectedChannel = ref<ChannelType>('gemini')

// 可用的渠道选项
const channelOptions: { value: ChannelType; label: string }[] = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' }
]

// 展开的模块
const expandedModule = ref<string | null>(null)

// ========== Skills 管理 ==========

const skills = ref<SkillDefinition[]>([])
const isSavingSkills = ref(false)
const skillsMessage = ref('')

const showSkillModal = ref(false)
const isEditingSkill = ref(false)
const editingSkillOriginalId = ref<string | null>(null)
const skillFormError = ref('')
const skillForm = reactive<SkillDefinition>({
  id: '',
  name: '',
  description: '',
  prompt: ''
})

const showDeleteSkillConfirm = ref(false)
const pendingDeleteSkillId = ref<string | null>(null)

// Install from URL
const showInstallSkillModal = ref(false)
const installUrl = ref('')
const isInstallingSkill = ref(false)
const installSkillError = ref('')

function normalizeSkills(raw: unknown): SkillDefinition[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((s): s is any => s && typeof s === 'object')
    .map((s: any) => ({
      id: String(s.id || '').trim(),
      name: String(s.name || '').trim(),
      description: typeof s.description === 'string' ? s.description : '',
      prompt: String(s.prompt || '')
    }))
    .filter(s => s.id)
}

async function persistSkills(nextSkills: SkillDefinition[]) {
  isSavingSkills.value = true
  skillsMessage.value = ''

  try {
    await sendToExtension('updateSystemPromptConfig', {
      config: { skills: nextSkills }
    })
    skills.value = nextSkills
    skillsMessage.value = t('components.settings.promptSettings.skills.saveSuccess')
    setTimeout(() => { skillsMessage.value = '' }, 2000)
  } catch (error) {
    console.error('Failed to save skills:', error)
    skillsMessage.value = t('components.settings.promptSettings.skills.saveFailed')
  } finally {
    isSavingSkills.value = false
  }
}

function openAddSkill() {
  isEditingSkill.value = false
  editingSkillOriginalId.value = null
  skillFormError.value = ''
  skillForm.id = ''
  skillForm.name = ''
  skillForm.description = ''
  skillForm.prompt = ''
  showSkillModal.value = true
}

function openEditSkill(skill: SkillDefinition) {
  isEditingSkill.value = true
  editingSkillOriginalId.value = skill.id
  skillFormError.value = ''
  skillForm.id = skill.id
  skillForm.name = skill.name
  skillForm.description = skill.description || ''
  skillForm.prompt = skill.prompt
  showSkillModal.value = true
}

async function confirmSkillModal() {
  const id = skillForm.id.trim()
  const name = skillForm.name.trim()
  const prompt = skillForm.prompt.trim()

  if (!id) {
    skillFormError.value = t('components.settings.promptSettings.skills.validation.idRequired')
    return
  }
  if (!prompt) {
    skillFormError.value = t('components.settings.promptSettings.skills.validation.promptRequired')
    return
  }

  const nextSkills = [...skills.value]

  // 唯一性校验
  const duplicate = nextSkills.find(s => s.id === id && s.id !== editingSkillOriginalId.value)
  if (duplicate) {
    skillFormError.value = t('components.settings.promptSettings.skills.validation.idDuplicate')
    return
  }

  const nextSkill: SkillDefinition = {
    id,
    name: name || id,
    description: skillForm.description?.trim() || '',
    prompt: skillForm.prompt
  }

  if (isEditingSkill.value && editingSkillOriginalId.value) {
    const index = nextSkills.findIndex(s => s.id === editingSkillOriginalId.value)
    if (index !== -1) {
      nextSkills[index] = nextSkill
    } else {
      nextSkills.push(nextSkill)
    }
  } else {
    nextSkills.push(nextSkill)
  }

  // 排序（按 name，再按 id）
  nextSkills.sort((a, b) => {
    const nameCmp = (a.name || a.id).localeCompare(b.name || b.id)
    if (nameCmp !== 0) return nameCmp
    return a.id.localeCompare(b.id)
  })

  showSkillModal.value = false
  await persistSkills(nextSkills)
}

function requestDeleteSkill(id: string) {
  pendingDeleteSkillId.value = id
  showDeleteSkillConfirm.value = true
}

async function confirmDeleteSkill() {
  if (!pendingDeleteSkillId.value) return
  const id = pendingDeleteSkillId.value
  pendingDeleteSkillId.value = null

  const nextSkills = skills.value.filter(s => s.id !== id)
  await persistSkills(nextSkills)
}

function openInstallSkill() {
  installUrl.value = ''
  installSkillError.value = ''
  showInstallSkillModal.value = true
}

async function confirmInstallSkill() {
  const url = installUrl.value.trim()
  if (!url) {
    installSkillError.value = t('components.settings.promptSettings.skills.installFromUrl.validation.urlRequired')
    return
  }

  isInstallingSkill.value = true
  installSkillError.value = ''

  try {
    const result = await sendToExtension<{ skills?: SkillDefinition[] }>('installSkillFromUrl', { url })
    const installed = Array.isArray(result?.skills) ? result.skills : []

    if (installed.length === 0) {
      installSkillError.value = t('components.settings.promptSettings.skills.installFromUrl.validation.noSkillsFound')
      return
    }

    const nextSkills = [...skills.value]
    for (const skill of installed) {
      if (!skill?.id) continue
      const idx = nextSkills.findIndex(s => s.id === skill.id)
      if (idx !== -1) {
        nextSkills[idx] = skill
      } else {
        nextSkills.push(skill)
      }
    }

    nextSkills.sort((a, b) => {
      const nameCmp = (a.name || a.id).localeCompare(b.name || b.id)
      if (nameCmp !== 0) return nameCmp
      return a.id.localeCompare(b.id)
    })

    showInstallSkillModal.value = false
    await persistSkills(nextSkills)
  } catch (error: any) {
    installSkillError.value = error.message || t('components.settings.promptSettings.skills.installFromUrl.installFailed')
  } finally {
    isInstallingSkill.value = false
  }
}

// 加载配置
async function loadConfig() {
  isLoading.value = true
  try {
    const result = await sendToExtension<SystemPromptConfig>('getSystemPromptConfig', {})
    if (result) {
      config.template = result.template || DEFAULT_TEMPLATE
      config.customPrefix = result.customPrefix || ''
      config.customSuffix = result.customSuffix || ''
      skills.value = normalizeSkills(result.skills)
      originalConfig.value = { ...config }
    }
  } catch (error) {
    console.error('Failed to load system prompt config:', error)
  } finally {
    isLoading.value = false
  }
}

// 保存配置
async function saveConfig() {
  isSaving.value = true
  saveMessage.value = ''
  try {
    await sendToExtension('updateSystemPromptConfig', {
      config: {
        template: config.template,
        customPrefix: config.customPrefix,
        customSuffix: config.customSuffix
      }
    })
    originalConfig.value = { ...config }
    saveMessage.value = t('components.settings.promptSettings.saveSuccess')
    setTimeout(() => { saveMessage.value = '' }, 2000)
    
    // 保存成功后自动更新 token 计数
    await countTokens()
  } catch (error) {
    console.error('Failed to save system prompt config:', error)
    saveMessage.value = t('components.settings.promptSettings.saveFailed')
  } finally{
    isSaving.value = false
  }
}

// 计算 token 数量
async function countTokens() {
  if (!config.template) {
    tokenCount.value = null
    return
  }
  
  isCountingTokens.value = true
  tokenCountError.value = ''
  
  try {
    const result = await sendToExtension<{
      success: boolean
      totalTokens?: number
      error?: string
    }>('countSystemPromptTokens', {
      text: config.template,
      channelType: selectedChannel.value
    })
    
    if (result?.success && result.totalTokens !== undefined) {
      tokenCount.value = result.totalTokens
    } else {
      tokenCount.value = null
      tokenCountError.value = result?.error || 'Token count failed'
    }
  } catch (error: any) {
    console.error('Failed to count tokens:', error)
    tokenCount.value = null
    tokenCountError.value = error.message || 'Token count failed'
  } finally {
    isCountingTokens.value = false
  }
}

// 格式化 token 数量显示
function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

// 重置为默认模板
function resetToDefault() {
  config.template = DEFAULT_TEMPLATE
}

// 插入变量占位符
function insertModule(moduleId: string) {
  const placeholder = `{{$${moduleId}}}`
  config.template += placeholder
}

// 切换模块展开
function toggleModule(moduleId: string) {
  expandedModule.value = expandedModule.value === moduleId ? null : moduleId
}

// 生成变量ID显示字符串（使用 {{$xxx}} 格式）
function formatModuleId(id: string): string {
  return `\{\{$${id}\}\}`
}

// 初始化
onMounted(async () => {
  await loadConfig()
  // 加载配置后自动计算 token 数量
  await countTokens()
})

// 监听渠道变化，重新计算 token
watch(selectedChannel, () => {
  countTokens()
})
</script>

<template>
  <div class="prompt-settings">
    <!-- 加载中 -->
    <div v-if="isLoading" class="loading-state">
      <i class="codicon codicon-loading codicon-modifier-spin"></i>
      <span>{{ t('components.settings.promptSettings.loading') }}</span>
    </div>
    
    <template v-else>
      <!-- 模板编辑区 -->
      <div class="template-section">
        <div class="section-header">
          <label class="section-label">
            <i class="codicon codicon-file-code"></i>
            {{ t('components.settings.promptSettings.templateSection.title') }}
          </label>
          <button class="reset-btn" @click="resetToDefault">
            <i class="codicon codicon-discard"></i>
            {{ t('components.settings.promptSettings.templateSection.resetButton') }}
          </button>
        </div>
        
        <p class="section-description">
          {{ t('components.settings.promptSettings.templateSection.description') }}
        </p>
        
        <textarea
          v-model="config.template"
          class="template-textarea"
          :placeholder="t('components.settings.promptSettings.templateSection.placeholder')"
          rows="16"
        ></textarea>
      </div>
      
      <!-- 保存按钮和 Token 计数 -->
      <div class="save-section">
        <div class="save-row">
          <button
            class="save-btn"
            @click="saveConfig"
            :disabled="isSaving || !hasChanges"
          >
            <i v-if="isSaving" class="codicon codicon-loading codicon-modifier-spin"></i>
            <span v-else>{{ t('components.settings.promptSettings.saveButton') }}</span>
          </button>
          <span v-if="saveMessage" class="save-message" :class="{ success: saveMessage === t('components.settings.promptSettings.saveSuccess') }">
            {{ saveMessage }}
          </span>
        </div>
        
        <!-- Token 计数显示 -->
        <div class="token-count-section">
          <div class="token-count-row">
            <label class="token-label">
              <i class="codicon codicon-symbol-numeric"></i>
              {{ t('components.settings.promptSettings.tokenCount.label') }}
            </label>
            
            <select
              v-model="selectedChannel"
              class="channel-select"
              :title="t('components.settings.promptSettings.tokenCount.channelTooltip')"
            >
              <option v-for="opt in channelOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
            
            <button
              class="refresh-btn"
              @click="countTokens"
              :disabled="isCountingTokens"
              :title="t('components.settings.promptSettings.tokenCount.refreshTooltip')"
            >
              <i :class="['codicon', isCountingTokens ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh']"></i>
            </button>
            
            <div class="token-value">
              <template v-if="isCountingTokens">
                <i class="codicon codicon-loading codicon-modifier-spin"></i>
              </template>
              <template v-else-if="tokenCount !== null">
                <span class="token-number">{{ formatTokenCount(tokenCount) }}</span>
                <span class="token-unit">tokens</span>
              </template>
              <template v-else-if="tokenCountError">
                <span class="token-error" :title="tokenCountError">
                  <i class="codicon codicon-warning"></i>
                  {{ t('components.settings.promptSettings.tokenCount.failed') }}
                </span>
              </template>
              <template v-else>
                <span class="token-na">--</span>
              </template>
            </div>
          </div>
          
          <p class="token-hint">
            {{ t('components.settings.promptSettings.tokenCount.hint') }}
          </p>
        </div>
      </div>
      
      <!-- 可用变量参考 -->
      <div class="modules-reference">
        <h5 class="reference-title">
          <i class="codicon codicon-references"></i>
          {{ t('components.settings.promptSettings.modulesReference.title') }}
        </h5>
        
        <div class="modules-list">
          <div
            v-for="module in AVAILABLE_PROMPT_MODULES"
            :key="module.id"
            class="module-item"
            :class="{ expanded: expandedModule === module.id }"
          >
            <div class="module-header" @click="toggleModule(module.id)">
              <div class="module-info">
                <code class="module-id">{{ formatModuleId(module.id) }}</code>
                <span class="module-name">{{ t(`components.settings.promptSettings.modules.${module.id}.name`) }}</span>
              </div>
              <button
                class="insert-btn"
                @click.stop="insertModule(module.id)"
                :title="t('components.settings.promptSettings.modulesReference.insertTooltip')"
              >
                <i class="codicon codicon-add"></i>
              </button>
            </div>
            
            <div v-if="expandedModule === module.id" class="module-details">
              <p class="module-description">{{ t(`components.settings.promptSettings.modules.${module.id}.description`) }}</p>
              
              <div v-if="module.requiresConfig" class="module-requires">
                <i class="codicon codicon-info"></i>
                <span>{{ t('components.settings.promptSettings.requiresConfigLabel') }} {{ t(`components.settings.promptSettings.modules.${module.id}.requiresConfig`) }}</span>
              </div>
              
              <div v-if="module.example" class="module-example">
                <label>{{ t('components.settings.promptSettings.exampleOutput') }}</label>
                <pre>{{ module.example }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Skills 管理 -->
      <div class="skills-section">
        <div class="skills-header">
          <h5 class="reference-title">
            <i class="codicon codicon-wand"></i>
            {{ t('components.settings.promptSettings.skills.title') }}
          </h5>
          <div class="skills-header-actions">
            <button class="reset-btn" @click="openInstallSkill" :disabled="isSavingSkills || isInstallingSkill">
              <i class="codicon codicon-cloud-download"></i>
              {{ t('components.settings.promptSettings.skills.installFromUrl.button') }}
            </button>
            <button class="reset-btn" @click="openAddSkill" :disabled="isSavingSkills">
              <i class="codicon codicon-add"></i>
              {{ t('components.settings.promptSettings.skills.add') }}
            </button>
          </div>
        </div>

        <p class="section-description">
          {{ t('components.settings.promptSettings.skills.description') }}
        </p>

        <div v-if="skills.length === 0" class="skills-empty">
          <i class="codicon codicon-info"></i>
          <span>{{ t('components.settings.promptSettings.skills.empty') }}</span>
        </div>

        <div v-else class="skills-list">
          <div v-for="skill in skills" :key="skill.id" class="skill-item">
            <div class="skill-main">
              <div class="skill-name">{{ skill.name || skill.id }}</div>
              <div class="skill-meta">
                <code class="skill-id">{{ skill.id }}</code>
                <span v-if="skill.description" class="skill-desc" :title="skill.description">{{ skill.description }}</span>
              </div>
            </div>
            <div class="skill-actions">
              <button class="skill-action" @click="openEditSkill(skill)" :disabled="isSavingSkills">
                <i class="codicon codicon-edit"></i>
                {{ t('common.edit') }}
              </button>
              <button class="skill-action danger" @click="requestDeleteSkill(skill.id)" :disabled="isSavingSkills">
                <i class="codicon codicon-trash"></i>
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="skillsMessage" class="skills-message" :class="{ success: skillsMessage === t('components.settings.promptSettings.skills.saveSuccess') }">
          {{ skillsMessage }}
        </div>
      </div>
    </template>
  </div>

  <!-- Skill 编辑/新增弹窗 -->
  <Modal
    v-model="showSkillModal"
    :title="isEditingSkill ? t('components.settings.promptSettings.skills.modal.editTitle') : t('components.settings.promptSettings.skills.modal.addTitle')"
    width="680px"
  >
    <div class="skill-form">
      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.modal.id') }}</label>
        <input v-model="skillForm.id" class="skill-form-input" :placeholder="t('components.settings.promptSettings.skills.modal.idPlaceholder')" />
      </div>

      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.modal.name') }}</label>
        <input v-model="skillForm.name" class="skill-form-input" :placeholder="t('components.settings.promptSettings.skills.modal.namePlaceholder')" />
      </div>

      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.modal.description') }}</label>
        <input v-model="skillForm.description" class="skill-form-input" :placeholder="t('components.settings.promptSettings.skills.modal.descriptionPlaceholder')" />
      </div>

      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.modal.prompt') }}</label>
        <textarea
          v-model="skillForm.prompt"
          class="skill-form-textarea"
          rows="10"
          :placeholder="t('components.settings.promptSettings.skills.modal.promptPlaceholder')"
        ></textarea>
      </div>

      <div v-if="skillFormError" class="skill-form-error">
        <i class="codicon codicon-warning"></i>
        <span>{{ skillFormError }}</span>
      </div>
    </div>

    <template #footer>
      <button class="dialog-btn cancel" @click="showSkillModal = false">{{ t('common.cancel') }}</button>
      <button class="dialog-btn confirm" @click="confirmSkillModal" :disabled="isSavingSkills">{{ t('common.save') }}</button>
    </template>
  </Modal>

  <!-- 删除 Skill 确认 -->
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

  <!-- 从 URL 安装 Skill -->
  <Modal
    v-model="showInstallSkillModal"
    :title="t('components.settings.promptSettings.skills.installFromUrl.modal.title')"
    width="680px"
  >
    <div class="skill-form">
      <div class="skill-form-row">
        <label class="skill-form-label">{{ t('components.settings.promptSettings.skills.installFromUrl.modal.url') }}</label>
        <input
          v-model="installUrl"
          class="skill-form-input"
          :placeholder="t('components.settings.promptSettings.skills.installFromUrl.modal.urlPlaceholder')"
        />
        <div class="skill-install-hint">
          {{ t('components.settings.promptSettings.skills.installFromUrl.modal.hint') }}
        </div>
      </div>

      <div v-if="installSkillError" class="skill-form-error">
        <i class="codicon codicon-warning"></i>
        <span>{{ installSkillError }}</span>
      </div>
    </div>

    <template #footer>
      <button class="dialog-btn cancel" @click="showInstallSkillModal = false" :disabled="isInstallingSkill">
        {{ t('common.cancel') }}
      </button>
      <button class="dialog-btn confirm" @click="confirmInstallSkill" :disabled="isInstallingSkill">
        <i v-if="isInstallingSkill" class="codicon codicon-loading codicon-modifier-spin"></i>
        <span v-else>{{ t('common.install') }}</span>
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.prompt-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--vscode-descriptionForeground);
}

.template-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skills-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.skills-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.skills-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-install-hint {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.skills-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 6px;
}

.skills-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--vscode-list-hoverBackground);
  border: 1px solid transparent;
  border-radius: 6px;
}

.skill-item:hover {
  border-color: var(--vscode-panel-border);
}

.skill-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.skill-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--vscode-foreground);
}

.skill-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.skill-id {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--vscode-textBlockQuote-background);
  color: var(--vscode-descriptionForeground);
}

.skill-desc {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.skill-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 12px;
  cursor: pointer;
}

.skill-action:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.skill-action.danger {
  border-color: rgba(241, 76, 76, 0.35);
  color: var(--vscode-errorForeground, #f14c4c);
}

.skill-action.danger:hover {
  background: rgba(241, 76, 76, 0.08);
}

.skills-message {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.skills-message.success {
  color: var(--vscode-testing-iconPassed, #89d185);
}

.skill-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skill-form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-form-label {
  font-size: 12px;
  color: var(--vscode-foreground);
}

.skill-form-input,
.skill-form-textarea {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-family: var(--vscode-font-family);
  font-size: 12px;
}

.skill-form-textarea {
  font-family: var(--vscode-editor-font-family);
  line-height: 1.4;
  resize: vertical;
}

.skill-form-error {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--vscode-errorForeground, #f14c4c);
}

.dialog-btn {
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s, opacity 0.15s;
}

.dialog-btn.cancel {
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
}

.dialog-btn.cancel:hover:not(:disabled) {
  background: var(--vscode-toolbar-hoverBackground);
}

.dialog-btn.confirm {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.dialog-btn.confirm:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.dialog-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
}

.section-label code {
  font-size: 11px;
  padding: 2px 4px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 3px;
  color: var(--vscode-textPreformat-foreground);
}

.section-description {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.section-description code {
  font-size: 11px;
  padding: 1px 4px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 3px;
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px;
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.reset-btn:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
}

.reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.template-textarea,
.custom-textarea {
  width: 100%;
  padding: 8px 10px;
  font-size: 12px;
  font-family: var(--vscode-editor-font-family), monospace;
  line-height: 1.5;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  resize: vertical;
  outline: none;
}

.template-textarea:focus,
.custom-textarea:focus {
  border-color: var(--vscode-focusBorder);
}

.template-textarea:disabled,
.custom-textarea:disabled {
  opacity: 0.6;
}

.save-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  padding: 8px 16px;
  font-size: 13px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.save-btn:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.save-message {
  font-size: 12px;
  color: var(--vscode-errorForeground);
}

.save-message.success {
  color: var(--vscode-terminal-ansiGreen);
}

/* Token 计数区域 */
.token-count-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
}

.token-count-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.token-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vscode-foreground);
}

.channel-select {
  padding: 4px 8px;
  font-size: 11px;
  background: var(--vscode-dropdown-background);
  color: var(--vscode-dropdown-foreground);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}

.channel-select:focus {
  border-color: var(--vscode-focusBorder);
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.token-value {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 13px;
}

.token-number {
  font-weight: 600;
  color: var(--vscode-charts-blue);
}

.token-unit {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.token-error {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--vscode-errorForeground);
  cursor: help;
}

.token-na {
  color: var(--vscode-descriptionForeground);
}

.token-hint {
  margin: 0;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

/* 模块参考 */
.modules-reference {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--vscode-panel-border);
}

.reference-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 500;
}

.modules-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.module-item {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  overflow: hidden;
}

.module-item.expanded {
  border-color: var(--vscode-focusBorder);
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.module-header:hover {
  background: var(--vscode-list-hoverBackground);
}

.module-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.module-id {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 3px;
  color: var(--vscode-textPreformat-foreground);
}

.module-name {
  font-size: 12px;
  color: var(--vscode-foreground);
}

.insert-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.insert-btn:hover:not(:disabled) {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-background);
}

.insert-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.module-details {
  padding: 10px 12px;
  background: var(--vscode-sideBar-background);
  border-top: 1px solid var(--vscode-panel-border);
}

.module-description {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.module-requires {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--vscode-notificationsInfoIcon-foreground);
}

.module-example {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.module-example label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.module-example pre {
  margin: 0;
  padding: 8px;
  font-size: 11px;
  font-family: var(--vscode-editor-font-family), monospace;
  line-height: 1.4;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Loading 动画 */
.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

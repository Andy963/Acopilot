<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { sendToExtension } from '@/utils/vscode'
import { useI18n } from '@/i18n'

const { t } = useI18n()

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
User Language: zh-CN`
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
- Always maintain code readability and maintainability.`

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

// 展开的模块
const expandedModule = ref<string | null>(null)

// 加载配置
async function loadConfig() {
  isLoading.value = true
  try {
    const result = await sendToExtension<SystemPromptConfig>('getSystemPromptConfig', {})
    if (result) {
      config.template = result.template || DEFAULT_TEMPLATE
      config.customPrefix = result.customPrefix || ''
      config.customSuffix = result.customSuffix || ''
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
  } catch (error) {
    console.error('Failed to save system prompt config:', error)
    saveMessage.value = t('components.settings.promptSettings.saveFailed')
  } finally{
    isSaving.value = false
  }
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
onMounted(() => {
  loadConfig()
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
      
      <!-- 保存按钮 -->
      <div class="save-section">
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
    </template>
  </div>
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
  align-items: center;
  gap: 12px;
  padding-top: 8px;
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
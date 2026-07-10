<script setup lang="ts">
/**
 * AutoExecSettings - 自动执行设置面板
 *
 * 功能：
 * 1. 显示所有可用工具列表
 * 2. 允许配置每个工具是否自动执行（无需用户确认）
 * 3. 默认情况下，危险工具（如 delete_file, execute_command）需要确认
 */

import { ref, computed, onMounted } from 'vue'
import { CustomCheckbox } from '../common'
import { sendToExtension } from '@/utils/vscode'
import { t } from '@/i18n'
import SettingsGroup from './common/SettingsGroup.vue'
import { getLocalizedToolDescription, getToolDisplayName } from './toolDisplay'

// 工具信息接口
interface ToolInfo {
  name: string
  description: string
  enabled: boolean
  category?: string
}

// 工具自动执行配置
interface ToolAutoExecConfig {
  [toolName: string]: boolean
}

// 工具列表
const tools = ref<ToolInfo[]>([])

// 自动执行配置
const autoExecConfig = ref<ToolAutoExecConfig>({})

// 加载状态
const isLoading = ref(false)

// 保存状态
const savingTools = ref<Set<string>>(new Set())

// 按分类分组的工具
const toolsByCategory = computed(() => {
  const grouped: Record<string, ToolInfo[]> = {}
  
  for (const tool of tools.value) {
    const category = tool.category || '其他'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(tool)
  }
  
  return grouped
})

// 获取分类显示名称
function getCategoryDisplayName(category: string): string {
  const key = `components.settings.autoExec.categories.${category}` as const
  return t(key)
}

// 分类图标映射
const categoryIcons: Record<string, string> = {
  'file': 'codicon-file',
  'search': 'codicon-search',
  'terminal': 'codicon-terminal',
  'lsp': 'codicon-symbol-class',
  'media': 'codicon-file-media',
  '其他': 'codicon-extensions'
}

// 加载工具列表和配置
async function loadData() {
  isLoading.value = true
  
  try {
    // 获取内置工具列表
    const toolsResponse = await sendToExtension<{ tools: ToolInfo[] }>('tools.getTools', {})
    tools.value = toolsResponse?.tools || []
    
    // 获取自动执行配置
    const configResponse = await sendToExtension<{ config: ToolAutoExecConfig }>('tools.getAutoExecConfig', {})
    if (configResponse?.config) {
      autoExecConfig.value = configResponse.config
    }
  } catch (error) {
    console.error('Failed to load data:', error)
  } finally {
    isLoading.value = false
  }
}

// 检查工具是否自动执行
function isAutoExec(toolName: string): boolean {
  // 如果未配置，默认自动执行
  if (autoExecConfig.value[toolName] === undefined) {
    return true
  }
  return autoExecConfig.value[toolName]
}

// 切换工具自动执行状态
async function toggleAutoExec(toolName: string, autoExec: boolean) {
  savingTools.value.add(toolName)
  
  try {
    await sendToExtension('tools.setToolAutoExec', {
      toolName,
      autoExec
    })
    
    // 更新本地状态
    autoExecConfig.value[toolName] = autoExec
  } catch (error) {
    console.error(`Failed to toggle auto exec for ${toolName}:`, error)
  } finally {
    savingTools.value.delete(toolName)
  }
}

// 全部自动执行
async function enableAllAutoExec() {
  for (const tool of tools.value) {
    if (!isAutoExec(tool.name)) {
      await toggleAutoExec(tool.name, true)
    }
  }
}

// 全部需要确认
async function disableAllAutoExec() {
  for (const tool of tools.value) {
    if (isAutoExec(tool.name)) {
      await toggleAutoExec(tool.name, false)
    }
  }
}

function getToolDescription(tool: ToolInfo): string {
  return getLocalizedToolDescription(tool, t)
}

// 获取分类图标
function getCategoryIcon(category: string): string {
  return categoryIcons[category] || 'codicon-extensions'
}

function getCategoryAutoExecCount(categoryTools: ToolInfo[]): number {
  return categoryTools.filter(tool => isAutoExec(tool.name)).length
}

// 检查工具是否是危险工具（默认需要确认）
function isDangerousTool(toolName: string): boolean {
  const dangerousTools = ['apply_diff', 'delete_file', 'execute_command', 'replace_in_files']
  return dangerousTools.includes(toolName)
}

// 组件挂载
onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="auto-exec-settings">
    <!-- 说明文字 -->
    <div class="settings-intro">
      <i class="codicon codicon-shield"></i>
      <div class="intro-content">
        <p class="intro-title">{{ t('components.settings.autoExec.intro.title') }}</p>
        <p class="intro-desc">{{ t('components.settings.autoExec.intro.description') }}</p>
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="auto-exec-actions">
      <button class="action-btn" @click="loadData" :disabled="isLoading">
        <i class="codicon" :class="isLoading ? 'codicon-loading codicon-modifier-spin' : 'codicon-refresh'"></i>
        {{ t('components.settings.autoExec.actions.refresh') }}
      </button>
      <button class="action-btn" @click="enableAllAutoExec">
        <i class="codicon codicon-check-all"></i>
        {{ t('components.settings.autoExec.actions.enableAll') }}
      </button>
      <button class="action-btn" @click="disableAllAutoExec">
        <i class="codicon codicon-shield"></i>
        {{ t('components.settings.autoExec.actions.disableAll') }}
      </button>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <i class="codicon codicon-loading codicon-modifier-spin"></i>
      <span>{{ t('components.settings.autoExec.status.loading') }}</span>
    </div>
    
    <!-- 空状态 -->
    <div v-else-if="tools.length === 0" class="empty-state">
      <i class="codicon codicon-tools"></i>
      <span>{{ t('components.settings.autoExec.status.empty') }}</span>
    </div>
    
    <!-- 工具列表 -->
    <div v-else class="tools-list">
      <SettingsGroup
        v-for="(categoryTools, category) in toolsByCategory"
        :key="category"
        :title="getCategoryDisplayName(category)"
        :icon="getCategoryIcon(category)"
        :badge="`${getCategoryAutoExecCount(categoryTools)}/${categoryTools.length}`"
        :storage-key="`acopilot.settings.autoExec.category.${category}`"
        :default-expanded="true"
      >
        <div class="category-rows">
          <div
            v-for="tool in categoryTools"
            :key="tool.name"
            class="tool-wrapper"
          >
            <div
              class="tool-item"
              :class="{ dangerous: isDangerousTool(tool.name) }"
            >
              <div class="tool-info">
                <div class="tool-name-row">
                  <span class="tool-name">{{ getToolDisplayName(tool) }}</span>
                  <span v-if="isDangerousTool(tool.name)" class="danger-badge">
                    <i class="codicon codicon-warning"></i>
                    {{ t('components.settings.autoExec.badges.dangerous') }}
                  </span>
                </div>
                <div class="tool-description">{{ getToolDescription(tool) }}</div>
              </div>

              <div class="tool-actions">
                <div
                  class="tool-toggle"
                  :class="{ saving: savingTools.has(tool.name) }"
                  :title="isAutoExec(tool.name) ? t('components.settings.autoExec.status.autoExecute') : t('components.settings.autoExec.status.needConfirm')"
                >
                  <CustomCheckbox
                    :modelValue="isAutoExec(tool.name)"
                    :disabled="savingTools.has(tool.name)"
                    @update:modelValue="(val: boolean) => toggleAutoExec(tool.name, val)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsGroup>
    </div>
    
    <!-- 提示信息 -->
    <div class="settings-tips">
      <i class="codicon codicon-info"></i>
      <div class="tips-content">
        <p>{{ t('components.settings.autoExec.tips.dangerousDefault') }}</p>
        <p>{{ t('components.settings.autoExec.tips.deleteFileWarning') }}</p>
        <p>{{ t('components.settings.autoExec.tips.executeCommandWarning') }}</p>
        <p>{{ t('components.settings.autoExec.tips.useWithCheckpoint') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped src="./AutoExecSettings.css"></style>

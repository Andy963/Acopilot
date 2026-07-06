<template>
  <div class="dependency-settings">
    <div class="section-header">
      <h3>{{ t('components.settings.dependencySettings.title') }}</h3>
      <p class="section-desc">{{ t('components.settings.dependencySettings.description') }}</p>
    </div>
    
    <div class="install-path" v-if="installPath">
      <span class="label">{{ t('components.settings.dependencySettings.installPath') }}</span>
      <code>{{ installPath }}</code>
    </div>
    <div class="path-note">
      <i class="codicon codicon-info"></i>
      <span>{{ t('components.settings.dependencySettings.pathRelation') }}</span>
    </div>
    
    <!-- 安装进度消息 -->
    <div v-if="progressMessage" class="progress-message" :class="progressType">
      <i :class="progressIcon"></i>
      <span>{{ progressMessage }}</span>
      <button
        v-if="progressType === 'error' && lastFailureLog"
        class="copy-log-button"
        @click="copyFailureLog"
      >
        <i class="codicon codicon-copy"></i>
        {{ t('components.settings.dependencySettings.copyFailureLog') }}
      </button>
    </div>
    
    <!-- 按工具分组的依赖面板 -->
    <div class="tool-panels">
      <div
        v-for="panel in toolPanels"
        :key="panel.toolName"
        class="tool-panel"
      >
        <!-- 工具面板头部 -->
        <div
          class="panel-header"
          :class="{ expanded: expandedPanels.has(panel.toolName) }"
          @click="togglePanel(panel.toolName)"
        >
          <i class="codicon codicon-chevron-right expand-icon"></i>
          <span class="panel-title">{{ panel.displayName }}</span>
          <span class="deps-count" :class="{ 'all-installed': areAllDepsInstalled(panel.dependencies) }">
            {{ getInstalledCount(panel.dependencies) }}/{{ panel.dependencies.length }}
          </span>
        </div>
        
        <!-- 工具面板内容 -->
        <div v-if="expandedPanels.has(panel.toolName)" class="panel-content">
          <div
            v-for="depName in panel.dependencies"
            :key="depName"
            class="dependency-item"
            :class="{ installed: isDependencyInstalled(depName) }"
          >
            <div class="dep-info">
              <div class="dep-header">
                <span class="dep-name">{{ depName }}</span>
                <span class="dep-version">{{ getDependencyInfo(depName)?.version || '' }}</span>
                <span v-if="isDependencyInstalled(depName)" class="dep-installed-badge">
                  <i class="codicon codicon-check"></i>
                  {{ t('components.settings.dependencySettings.installed') }}
                </span>
              </div>
              <p class="dep-description">{{ getDependencyInfo(depName)?.description || '' }}</p>
              <div class="dep-meta" v-if="getDependencyInfo(depName)?.estimatedSize">
                <span class="dep-size">
                  <i class="codicon codicon-database"></i>
                  {{ t('components.settings.dependencySettings.estimatedSize', { size: getDependencyInfo(depName)?.estimatedSize }) }}
                </span>
              </div>
            </div>
            
            <div class="dep-actions">
              <button
                v-if="!isDependencyInstalled(depName)"
                class="action-button install-btn"
                :disabled="installing === depName"
                @click.stop="installDependency(depName)"
              >
                <i v-if="installing === depName" class="codicon codicon-loading codicon-modifier-spin"></i>
                <i v-else class="codicon codicon-cloud-download"></i>
                {{ installing === depName ? t('components.settings.dependencySettings.installing') : t('components.settings.dependencySettings.install') }}
              </button>
              
              <button
                v-else
                class="action-button uninstall-btn"
                :disabled="uninstalling === depName"
                @click.stop="requestUninstallDependency(depName)"
              >
                <i v-if="uninstalling === depName" class="codicon codicon-loading codicon-modifier-spin"></i>
                <i v-else class="codicon codicon-trash"></i>
                {{ uninstalling === depName ? t('components.settings.dependencySettings.uninstalling') : t('components.settings.dependencySettings.uninstall') }}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="toolPanels.length === 0" class="empty-state">
        <i class="codicon codicon-package"></i>
        <p>{{ t('components.settings.dependencySettings.empty') }}</p>
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmUninstallVisible"
      :title="t('components.settings.dependencySettings.uninstallConfirm.title')"
      :message="uninstallConfirmMessage"
      :confirm-text="t('components.settings.dependencySettings.uninstallConfirm.confirm')"
      :cancel-text="t('components.settings.dependencySettings.uninstallConfirm.cancel')"
      :is-danger="true"
      @confirm="confirmUninstallDependency"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { sendToExtension, showNotification } from '../../utils/vscode';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import { TOOL_DEPENDENCIES, getToolsForDependency } from '../../composables/useDependency';
import { useI18n } from '@/i18n';

const { t } = useI18n();

interface DependencyInfo {
  name: string;
  version: string;
  description: string;
  installed: boolean;
  installedVersion?: string;
  estimatedSize?: number;
}

interface ToolPanel {
  toolName: string;
  displayName: string;
  dependencies: string[];
}

const dependencies = ref<DependencyInfo[]>([]);
const installPath = ref<string>('');
const installing = ref<string | null>(null);
const uninstalling = ref<string | null>(null);
const progressMessage = ref<string>('');
const progressType = ref<'info' | 'success' | 'error'>('info');
const lastFailureLog = ref('');
const confirmUninstallVisible = ref(false);
const pendingUninstallDependency = ref<string | null>(null);

// 展开的面板（记住状态）
const STORAGE_KEY = 'acopilot.dependencyPanels.expanded';
const expandedPanels = ref<Set<string>>(new Set());

// 从 localStorage 恢复展开状态
function loadExpandedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const arr = JSON.parse(saved) as string[];
      expandedPanels.value = new Set(arr);
    }
  } catch {
    // 忽略错误
  }
}

// 保存展开状态到 localStorage
function saveExpandedState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...expandedPanels.value]));
  } catch {
    // 忽略错误
  }
}

// 切换面板展开状态
function togglePanel(toolName: string) {
  if (expandedPanels.value.has(toolName)) {
    expandedPanels.value.delete(toolName);
  } else {
    expandedPanels.value.add(toolName);
  }
  saveExpandedState();
}

// 工具面板列表
const toolPanels = computed<ToolPanel[]>(() => {
  const panels: ToolPanel[] = [];
  
  for (const [toolName, deps] of Object.entries(TOOL_DEPENDENCIES)) {
    if (deps.length > 0) {
      panels.push({
        toolName,
        displayName: getToolDisplayName(toolName),
        dependencies: deps
      });
    }
  }
  
  return panels;
});

// 获取工具显示名称
function getToolDisplayName(name: string): string {
  // 可以在这里添加工具名称的国际化映射
  // 目前使用默认格式化：将下划线转为空格并首字母大写
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// 检查依赖是否已安装
function isDependencyInstalled(depName: string): boolean {
  const dep = dependencies.value.find(d => d.name === depName);
  return dep?.installed ?? false;
}

// 获取依赖信息
function getDependencyInfo(depName: string): DependencyInfo | undefined {
  return dependencies.value.find(d => d.name === depName);
}

// 检查面板中所有依赖是否已安装
function areAllDepsInstalled(deps: string[]): boolean {
  return deps.every(dep => isDependencyInstalled(dep));
}

// 获取已安装的依赖数量
function getInstalledCount(deps: string[]): number {
  return deps.filter(dep => isDependencyInstalled(dep)).length;
}

function getAffectedToolNames(depName: string): string[] {
  return getToolsForDependency(depName).map(getToolDisplayName);
}

const uninstallConfirmMessage = computed(() => {
  const depName = pendingUninstallDependency.value || '';
  const tools = getAffectedToolNames(depName);
  const affectedTools = tools.length > 0
    ? tools.join(', ')
    : t('components.settings.dependencySettings.uninstallConfirm.none');

  return t('components.settings.dependencySettings.uninstallConfirm.message', {
    name: depName,
    tools: affectedTools
  });
});

const progressIcon = computed(() => {
  switch (progressType.value) {
    case 'success':
      return 'codicon codicon-check';
    case 'error':
      return 'codicon codicon-error';
    default:
      return 'codicon codicon-info';
  }
});

// 加载依赖列表
async function loadDependencies() {
  try {
    const result = await sendToExtension<{ dependencies: DependencyInfo[] }>('dependencies.list', {});
    dependencies.value = result.dependencies || [];
  } catch (error) {
    console.error('Failed to load dependencies:', error);
  }
}

function buildFailureLog(params: {
  action: 'install' | 'uninstall';
  name: string;
  message: string;
  log?: string;
}): string {
  return [
    `Dependency ${params.action} failed`,
    `Time: ${new Date().toISOString()}`,
    `Dependency: ${params.name}`,
    installPath.value ? `Install path: ${installPath.value}` : '',
    `Error: ${params.message}`,
    params.log ? `Backend log:\n${params.log}` : ''
  ].filter(Boolean).join('\n');
}

async function copyFailureLog() {
  if (!lastFailureLog.value) return;

  try {
    await navigator.clipboard.writeText(lastFailureLog.value);
    await showNotification(t('components.settings.dependencySettings.copyFailureLogSuccess'), 'info');
  } catch {
    await showNotification(t('components.settings.dependencySettings.copyFailureLogFailed'), 'error');
  }
}

// 获取安装路径
async function getInstallPath() {
  try {
    const result = await sendToExtension<{ path: string }>('dependencies.getInstallPath', {});
    installPath.value = result.path || '';
  } catch (error) {
    console.error('Failed to get install path:', error);
  }
}

// 安装依赖
async function installDependency(name: string) {
  installing.value = name;
  progressMessage.value = '';
  lastFailureLog.value = '';
  
  try {
    const result = await sendToExtension<{ success: boolean; log?: string }>('dependencies.install', { name });
    
    if (result.success) {
      progressType.value = 'success';
      progressMessage.value = t('components.settings.dependencySettings.progress.installSuccess', { name });
      await loadDependencies();
    } else {
      progressType.value = 'error';
      progressMessage.value = t('components.settings.dependencySettings.progress.installFailed', { name });
      lastFailureLog.value = buildFailureLog({
        action: 'install',
        name,
        message: progressMessage.value,
        log: result.log
      });
    }
  } catch (error: any) {
    progressType.value = 'error';
    progressMessage.value = t('components.settings.dependencySettings.progress.installFailed', { name }) + ': ' + (error.message || t('components.settings.dependencySettings.progress.unknownError'));
    lastFailureLog.value = buildFailureLog({
      action: 'install',
      name,
      message: error.message || t('components.settings.dependencySettings.progress.unknownError')
    });
  } finally {
    installing.value = null;
  }
}

function requestUninstallDependency(name: string) {
  pendingUninstallDependency.value = name;
  confirmUninstallVisible.value = true;
}

function confirmUninstallDependency() {
  const name = pendingUninstallDependency.value;
  pendingUninstallDependency.value = null;
  if (name) void uninstallDependency(name);
}

// 卸载依赖
async function uninstallDependency(name: string) {
  uninstalling.value = name;
  progressMessage.value = '';
  lastFailureLog.value = '';
  
  try {
    const result = await sendToExtension<{ success: boolean; log?: string }>('dependencies.uninstall', { name });
    
    if (result.success) {
      progressType.value = 'success';
      progressMessage.value = t('components.settings.dependencySettings.progress.uninstallSuccess', { name });
      await loadDependencies();
    } else {
      progressType.value = 'error';
      progressMessage.value = t('components.settings.dependencySettings.progress.uninstallFailed', { name });
      lastFailureLog.value = buildFailureLog({
        action: 'uninstall',
        name,
        message: progressMessage.value,
        log: result.log
      });
    }
  } catch (error: any) {
    progressType.value = 'error';
    progressMessage.value = t('components.settings.dependencySettings.progress.uninstallFailed', { name }) + ': ' + (error.message || t('components.settings.dependencySettings.progress.unknownError'));
    lastFailureLog.value = buildFailureLog({
      action: 'uninstall',
      name,
      message: error.message || t('components.settings.dependencySettings.progress.unknownError')
    });
  } finally {
    uninstalling.value = null;
  }
}

// 监听进度事件
function handleProgressEvent(event: any) {
  const { type, dependency, message, error, log } = event;
  
  switch (type) {
    case 'start':
    case 'progress':
      progressType.value = 'info';
      progressMessage.value = message || t('components.settings.dependencySettings.progress.processing', { dependency });
      break;
    case 'complete':
      progressType.value = 'success';
      progressMessage.value = message || t('components.settings.dependencySettings.progress.complete', { dependency });
      break;
    case 'error':
      progressType.value = 'error';
      progressMessage.value = error || t('components.settings.dependencySettings.progress.failed', { dependency });
      lastFailureLog.value = buildFailureLog({
        action: installing.value === dependency ? 'install' : 'uninstall',
        name: dependency,
        message: progressMessage.value,
        log
      });
      break;
  }
}

// 消息处理器
function handleMessage(event: MessageEvent) {
  const message = event.data;
  if (message.type === 'dependencyProgress') {
    handleProgressEvent(message.data);
  }
}

onMounted(() => {
  loadExpandedState();
  loadDependencies();
  getInstallPath();
  window.addEventListener('message', handleMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
});
</script>

<style scoped src="./DependencySettings.css"></style>
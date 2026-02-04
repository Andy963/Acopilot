import { computed, onMounted, ref } from 'vue'
import { sendToExtension } from '@/utils/vscode'
import { getToolDependencies, TOOL_DEPENDENCIES, useDependency } from '@/composables/useDependency'
import { useI18n } from '@/composables'

export interface ToolInfo {
  name: string
  description: string
  enabled: boolean
  category?: string
  serverId?: string
  serverName?: string
}

export interface ToolAutoExecConfig {
  [toolName: string]: boolean
}

const uniqueDependencies = [...new Set(Object.values(TOOL_DEPENDENCIES).flat())]

export function useToolsSettings() {
  const { t } = useI18n()

  const maxToolIterations = ref<number>(0)
  const isLoadingMaxIterations = ref(false)
  const isSavingMaxIterations = ref(false)

  const { dependencyStatus, checkDependencies: loadDependencies } = useDependency({
    dependencies: uniqueDependencies,
    autoCheck: false,
  })

  const expandedTools = ref<Set<string>>(new Set())
  function toggleConfigPanel(toolName: string) {
    if (expandedTools.value.has(toolName)) {
      expandedTools.value.delete(toolName)
    } else {
      expandedTools.value.add(toolName)
    }
  }

  function isConfigExpanded(toolName: string): boolean {
    return expandedTools.value.has(toolName)
  }

  function hasConfigPanel(toolName: string): boolean {
    const toolsWithConfig = [
      'list_files',
      'apply_diff',
      'execute_command',
      'find_files',
      'search_in_files',
      'locate',
      'generate_image',
      'remove_background',
      'crop_image',
      'resize_image',
      'rotate_image',
    ]
    return toolsWithConfig.includes(toolName)
  }

  function getMissingDependencies(toolName: string): string[] {
    const required = getToolDependencies(toolName)
    return required.filter(dep => dependencyStatus.value.get(dep) !== true)
  }

  function areAllDependenciesInstalled(toolName: string): boolean {
    const required = getToolDependencies(toolName)
    return required.every(dep => dependencyStatus.value.get(dep) === true)
  }

  const tools = ref<ToolInfo[]>([])
  const autoExecConfig = ref<ToolAutoExecConfig>({})

  const isLoading = ref(false)
  const savingTools = ref<Set<string>>(new Set())
  const savingAutoExecTools = ref<Set<string>>(new Set())

  const toolsByCategory = computed(() => {
    const grouped: Record<string, ToolInfo[]> = {}

    for (const tool of tools.value) {
      const category = tool.category || 'other'
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(tool)
    }

    return grouped
  })

  const orderedCategories = computed(() => {
    const rank: Record<string, number> = {
      file: 0,
      search: 1,
      terminal: 2,
      lsp: 3,
      mcp: 4,
      other: 5,
      media: 6,
    }

    return Object.entries(toolsByCategory.value)
      .sort(([a], [b]) => {
        const ra = rank[a] ?? rank.other
        const rb = rank[b] ?? rank.other
        if (ra !== rb) return ra - rb
        return a.localeCompare(b)
      })
      .map(([category, categoryTools]) => ({ category, tools: categoryTools }))
  })

  function isMcpTool(tool: ToolInfo): boolean {
    return tool.category === 'mcp'
  }

  function isDangerousTool(toolName: string): boolean {
    return ['delete_file', 'execute_command'].includes(toolName)
  }

  function isAutoExec(toolName: string): boolean {
    if (autoExecConfig.value[toolName] === undefined) return true
    return autoExecConfig.value[toolName]
  }

  function getCategoryNameKey(category: string): string {
    const mapping: Record<string, string> = {
      file: 'components.settings.toolsSettings.categories.file',
      search: 'components.settings.toolsSettings.categories.search',
      terminal: 'components.settings.toolsSettings.categories.terminal',
      lsp: 'components.settings.toolsSettings.categories.lsp',
      media: 'components.settings.toolsSettings.categories.media',
      mcp: 'components.settings.toolsSettings.categories.mcp',
      other: 'components.settings.toolsSettings.categories.other',
    }
    return mapping[category] || mapping.other
  }

  const categoryIcons: Record<string, string> = {
    file: 'codicon-file',
    search: 'codicon-search',
    terminal: 'codicon-terminal',
    lsp: 'codicon-symbol-class',
    media: 'codicon-file-media',
    mcp: 'codicon-plug',
    other: 'codicon-extensions',
  }

  function getToolDisplayName(name: string): string {
    return name.replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase())
  }

  function getCategoryDisplayName(category: string): string {
    return t(getCategoryNameKey(category))
  }

  function getCategoryIcon(category: string): string {
    return categoryIcons[category] || categoryIcons.other
  }

  function getCategoryEnabledCount(categoryTools: ToolInfo[]): number {
    return categoryTools.filter(tool => !isMcpTool(tool) && tool.enabled).length
  }

  function getCategoryEnabledTotal(categoryTools: ToolInfo[]): number {
    return categoryTools.filter(tool => !isMcpTool(tool)).length
  }

  function getCategoryAutoExecCount(categoryTools: ToolInfo[]): number {
    return categoryTools.filter(tool => isAutoExec(tool.name)).length
  }

  async function loadTools() {
    isLoading.value = true

    try {
      const response = await sendToExtension<{ tools: ToolInfo[] }>('tools.getTools', {})
      let allTools: ToolInfo[] = response?.tools || []

      try {
        const mcpResponse = await sendToExtension<{ tools: ToolInfo[] }>('tools.getMcpTools', {})
        if (mcpResponse?.tools) allTools = [...allTools, ...mcpResponse.tools]
      } catch (mcpError) {
        console.warn('Failed to load MCP tools:', mcpError)
      }

      tools.value = allTools

      const configResponse = await sendToExtension<{ config: ToolAutoExecConfig }>('tools.getAutoExecConfig', {})
      autoExecConfig.value = configResponse?.config || {}
    } catch (error) {
      console.error('Failed to load tools:', error)
    } finally {
      isLoading.value = false
    }
  }

  async function toggleTool(toolName: string, enabled: boolean) {
    savingTools.value.add(toolName)
    try {
      await sendToExtension('tools.toggleTool', { name: toolName, enabled })
      const tool = tools.value.find(t => t.name === toolName)
      if (tool) tool.enabled = enabled
    } catch (error) {
      console.error('Failed to toggle tool:', error)
    } finally {
      savingTools.value.delete(toolName)
    }
  }

  async function toggleAutoExec(toolName: string, enabled: boolean) {
    savingAutoExecTools.value.add(toolName)
    try {
      await sendToExtension('tools.updateAutoExecConfig', { name: toolName, enabled })
      autoExecConfig.value = { ...autoExecConfig.value, [toolName]: enabled }
    } catch (error) {
      console.error('Failed to update auto exec config:', error)
    } finally {
      savingAutoExecTools.value.delete(toolName)
    }
  }

  async function enableAll() {
    const disabledTools = tools.value.filter(tool => !isMcpTool(tool) && !tool.enabled)
    for (const tool of disabledTools) {
      await toggleTool(tool.name, true)
    }
  }

  async function disableAll() {
    const enabledTools = tools.value.filter(tool => !isMcpTool(tool) && tool.enabled)
    for (const tool of enabledTools) {
      await toggleTool(tool.name, false)
    }
  }

  const confirmEnableDangerousAutoExecDialogVisible = ref(false)

  async function enableAllAutoExec() {
    if (tools.value.some(tool => isDangerousTool(tool.name))) {
      confirmEnableDangerousAutoExecDialogVisible.value = true
      return
    }

    for (const tool of tools.value) {
      if (!isAutoExec(tool.name)) await toggleAutoExec(tool.name, true)
    }
  }

  async function confirmEnableAllAutoExec(includeDangerous: boolean) {
    confirmEnableDangerousAutoExecDialogVisible.value = false

    for (const tool of tools.value) {
      if (isDangerousTool(tool.name) && !includeDangerous) continue
      if (!isAutoExec(tool.name)) await toggleAutoExec(tool.name, true)
    }
  }

  async function disableAllAutoExec() {
    for (const tool of tools.value) {
      if (isAutoExec(tool.name)) await toggleAutoExec(tool.name, false)
    }
  }

  async function loadMaxToolIterations() {
    isLoadingMaxIterations.value = true
    try {
      const response = await sendToExtension<{ maxIterations: number }>('tools.getMaxToolIterations', {})
      if (response?.maxIterations !== undefined) maxToolIterations.value = response.maxIterations
    } catch (error) {
      console.error('Failed to load maxToolIterations:', error)
    } finally {
      isLoadingMaxIterations.value = false
    }
  }

  async function saveMaxToolIterations(value: number) {
    isSavingMaxIterations.value = true
    try {
      await sendToExtension('tools.updateMaxToolIterations', { maxIterations: value })
      maxToolIterations.value = value
    } catch (error) {
      console.error('Failed to save maxToolIterations:', error)
    } finally {
      isSavingMaxIterations.value = false
    }
  }

  function handleMaxIterationsChange(event: Event) {
    const target = event.target as HTMLInputElement
    const value = parseInt(target.value, 10)
    if (!isNaN(value) && (value === -1 || value >= 1)) {
      void saveMaxToolIterations(value)
    }
  }

  onMounted(() => {
    void loadTools()
    void loadDependencies()
    void loadMaxToolIterations()
  })

  return {
    t,
    maxToolIterations,
    isLoadingMaxIterations,
    isSavingMaxIterations,
    handleMaxIterationsChange,
    dependencyStatus,
    loadDependencies,
    hasConfigPanel,
    getMissingDependencies,
    areAllDependenciesInstalled,
    expandedTools,
    toggleConfigPanel,
    isConfigExpanded,
    tools,
    autoExecConfig,
    isLoading,
    savingTools,
    savingAutoExecTools,
    toolsByCategory,
    orderedCategories,
    isMcpTool,
    isDangerousTool,
    isAutoExec,
    loadTools,
    toggleTool,
    toggleAutoExec,
    enableAll,
    disableAll,
    confirmEnableDangerousAutoExecDialogVisible,
    enableAllAutoExec,
    confirmEnableAllAutoExec,
    disableAllAutoExec,
    getToolDisplayName,
    getCategoryDisplayName,
    getCategoryIcon,
    getCategoryEnabledCount,
    getCategoryEnabledTotal,
    getCategoryAutoExecCount,
  }
}


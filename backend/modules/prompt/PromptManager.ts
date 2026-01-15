/**
 * LimCode - 系统提示词管理器
 *
 * 负责组装和管理系统提示词，包括工作区文件树等动态内容
 *
 * 支持模板化系统提示词，使用 {{MODULE_NAME}} 占位符引用模块
 */

import * as vscode from 'vscode'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import type { PromptConfig, PromptContext } from './types'
import { getWorkspaceFileTree, getWorkspaceRoot, getWorkspacesDescription, getAllWorkspaces } from './fileTree'
import { getGlobalSettingsManager } from '../../core/settingsContext'
import type { ContextInjectionOverrides } from '../conversation/types'

/**
 * 系统提示词管理器
 * 
 * 功能：
 * 1. 生成动态系统提示词
 * 2. 包含工作区文件树
 * 3. 支持自定义前缀/后缀
 * 4. 缓存和更新机制
 */
export class PromptManager {
    private config: PromptConfig
    private cachedPrompt: string | null = null
    private lastGeneratedAt: number = 0
    
    // 缓存有效期（毫秒）- 1分钟
    private static readonly CACHE_TTL = 60000
    
    constructor(config: Partial<PromptConfig> = {}) {
        this.config = {
            includeWorkspaceFiles: true,
            maxDepth: 2,
            ...config
        }
    }
    
    /**
     * 更新配置
     */
    updateConfig(config: Partial<PromptConfig>): void {
        this.config = { ...this.config, ...config }
        // 清除缓存
        this.invalidateCache()
    }
    
    /**
     * 使缓存失效
     */
    invalidateCache(): void {
        this.cachedPrompt = null
        this.lastGeneratedAt = 0
    }
    
    /**
     * 获取系统提示词（使用缓存）
     */
    getSystemPrompt(forceRefresh: boolean = false, overrides?: ContextInjectionOverrides): string {
        const now = Date.now()

        // 有本次消息级覆写时不使用缓存（覆写不会持久化到全局设置）
        if (overrides) {
            return this.generatePrompt(overrides)
        }
        
        // 检查缓存是否有效
        if (!forceRefresh && 
            this.cachedPrompt !== null && 
            (now - this.lastGeneratedAt) < PromptManager.CACHE_TTL) {
            return this.cachedPrompt
        }
        
        // 生成新的提示词
        this.cachedPrompt = this.generatePrompt()
        this.lastGeneratedAt = now
        
        return this.cachedPrompt
    }
    
    /**
     * 强制刷新并获取系统提示词
     * 
     * 在以下情况下调用：
     * - 新对话的第一条消息
     * - 用户删除首条消息后重新发送
     * - 用户编辑首条消息后重试
     */
    refreshAndGetPrompt(overrides?: ContextInjectionOverrides): string {
        return this.getSystemPrompt(true, overrides)
    }
    
    /**
     * 生成系统提示词
     *
     * 始终使用模板模式生成提示词
     * 用户可以通过设置自定义模板内容
     */
    private generatePrompt(overrides?: ContextInjectionOverrides): string {
        const settingsManager = getGlobalSettingsManager()
        const promptConfig = settingsManager?.getSystemPromptConfig()
        
        // 始终使用模板化生成
        const template = promptConfig?.template || ''
        return this.generateFromTemplate(
            template,
            promptConfig?.customPrefix || '',
            promptConfig?.customSuffix || '',
            overrides
        )
    }
    
    /**
     * 从模板生成系统提示词
     *
     * 支持的占位符（使用 {{$xxx}} 格式）：
     * - {{$ENVIRONMENT}} - 环境信息
     * - {{$WORKSPACE_FILES}} - 工作区文件树
     * - {{$OPEN_TABS}} - 打开的标签页
     * - {{$ACTIVE_EDITOR}} - 当前活动编辑器
     * - {{$DIAGNOSTICS}} - VSCode 诊断信息（错误、警告等）
     * - {{$PINNED_FILES}} - 固定文件内容
     * - {{$TOOLS}} - 工具定义（由外部填充）
     * - {{$MCP_TOOLS}} - MCP 工具定义（由外部填充）
     */
    private generateFromTemplate(
        template: string,
        customPrefix: string,
        customSuffix: string,
        overrides?: ContextInjectionOverrides
    ): string {
        const settingsManager = getGlobalSettingsManager()
        const contextConfig = settingsManager?.getContextAwarenessConfig()
        const ignorePatterns = contextConfig?.ignorePatterns ?? []
        
        // 生成各模块内容
        const modules: Record<string, string> = {
            'ENVIRONMENT': this.wrapSection('ENVIRONMENT', this.generateEnvironmentSection()),
            'WORKSPACE_FILES': (overrides?.includeWorkspaceFiles ?? contextConfig?.includeWorkspaceFiles ?? this.config.includeWorkspaceFiles)
                ? this.wrapSection('WORKSPACE FILES', this.generateFileTreeSection(
                    contextConfig?.maxFileDepth ?? this.config.maxDepth ?? 10,
                    ignorePatterns
                ))
                : '',
            'OPEN_TABS': (overrides?.includeOpenTabs ?? contextConfig?.includeOpenTabs)
                ? this.wrapSection('OPEN TABS', this.generateOpenTabsSection(
                    contextConfig?.maxOpenTabs ?? 20,
                    ignorePatterns
                ))
                : '',
            'ACTIVE_EDITOR': (overrides?.includeActiveEditor ?? contextConfig?.includeActiveEditor)
                ? this.wrapSection('ACTIVE EDITOR', this.generateActiveEditorSection(
                    ignorePatterns
                ))
                : '',
            'DIAGNOSTICS': this.wrapSection('DIAGNOSTICS', this.generateDiagnosticsSection(overrides?.includeDiagnostics)),
            'PINNED_FILES': (overrides?.includePinnedFiles === false)
                ? ''
                : this.wrapSection(
                    settingsManager?.getPinnedFilesConfig()?.sectionTitle || 'PINNED FILES CONTENT',
                    this.generatePinnedFilesSection()
                ),
            // 工具定义由外部在发送前填充，这里返回占位符
            'TOOLS': '{{$TOOLS}}',
            'MCP_TOOLS': '{{$MCP_TOOLS}}'
        }
        
        // 替换模板中的占位符（使用 {{$xxx}} 格式）
        let result = template
        for (const [key, value] of Object.entries(modules)) {
            const regex = new RegExp(`\\{\\{\\$${key}\\}\\}`, 'g')
            result = result.replace(regex, value)
        }
        
        return result.trim()
    }
    
    /**
     * 将内容包装为带标题的段落
     */
    private wrapSection(title: string, content: string | null): string {
        if (!content) return ''
        return `====\n\n${title}\n\n${content}`
    }
    
    /**
     * 生成环境信息段落
     */
    private generateEnvironmentSection(): string {
        const context = this.getContext()
        const lines: string[] = []
        
        // 工作区信息（支持多工作区）
        const workspaces = getAllWorkspaces()
        if (workspaces.length === 0) {
            lines.push('No workspace open')
        } else if (workspaces.length === 1) {
            lines.push(`Current Workspace: ${workspaces[0].fsPath}`)
        } else {
            lines.push('Multi-root Workspace:')
            for (const ws of workspaces) {
                lines.push(`  - ${ws.name}: ${ws.fsPath}`)
            }
            lines.push('')
            lines.push('Use "workspace_name/path" format to access files in specific workspace.')
        }
        
        if (context.os) {
            lines.push(`Operating System: ${context.os}`)
        }
        
        if (context.currentTime) {
            lines.push(`Current Time: ${context.currentTime}`)
        }
        
        if (context.timezone) {
            lines.push(`Timezone: ${context.timezone}`)
        }
        
        // User language environment
        const userLanguage = this.getUserLanguage()
        if (userLanguage) {
            lines.push(`User Language: ${userLanguage}`)
            lines.push(`Please respond using the user's language by default.`)
        }
        
        return lines.join('\n')
    }
    
    /**
     * 获取用户语言环境
     *
     * 根据设置返回用户当前使用的语言
     * - 如果设置为 'auto'，使用 VS Code 的语言设置
     * - 否则使用用户选择的语言
     */
    private getUserLanguage(): string {
        const settingsManager = getGlobalSettingsManager()
        const uiSettings = settingsManager?.getUISettings()
        const languageSetting = uiSettings?.language || 'auto'
        
        if (languageSetting === 'auto') {
            // 使用 VS Code 的语言设置
            return vscode.env.language || 'en'
        }
        
        return languageSetting
    }
    
    /**
     * 生成文件树段落
     */
    private generateFileTreeSection(maxDepth: number, ignorePatterns: string[]): string {
        const effectiveMaxDepth = maxDepth === -1 ? 100 : maxDepth  // -1 表示无限制，使用大值代替
        const fileTree = getWorkspaceFileTree(effectiveMaxDepth, ignorePatterns)
        
        if (!fileTree) {
            return ''
        }
        
        return `The following is a list of files in the current workspace:\n\n${fileTree}`
    }
    
    /**
     * 生成打开的标签页段落
     */
    private generateOpenTabsSection(maxTabs: number, ignorePatterns: string[]): string {
        const workspaceFolders = vscode.workspace.workspaceFolders
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return ''
        }
        
        const tabs: string[] = []
        
        // 遍历所有 tab groups
        for (const tabGroup of vscode.window.tabGroups.all) {
            for (const tab of tabGroup.tabs) {
                // 只处理文件类型的 tab
                if (tab.input instanceof vscode.TabInputText) {
                    const uri = tab.input.uri
                    
                    // 检查是否在工作区内
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
                    if (workspaceFolder) {
                        // 获取相对路径
                        const relativePath = vscode.workspace.asRelativePath(uri, false)
                        
                        // 检查是否应该被忽略
                        if (!this.shouldIgnorePath(relativePath, ignorePatterns)) {
                            tabs.push(relativePath)
                        }
                    }
                }
            }
        }
        
        // 去重
        const uniqueTabs = [...new Set(tabs)]
        
        // 应用最大数量限制
        const effectiveMaxTabs = maxTabs === -1 ? uniqueTabs.length : maxTabs
        const limitedTabs = uniqueTabs.slice(0, effectiveMaxTabs)
        
        if (limitedTabs.length === 0) {
            return ''
        }
        
        let result = `Currently open files in editor:\n`
        for (const tab of limitedTabs) {
            result += `  - ${tab}\n`
        }
        
        if (uniqueTabs.length > limitedTabs.length) {
            result += `  ... and ${uniqueTabs.length - limitedTabs.length} more files`
        }
        
        return result
    }
    
    /**
     * 生成当前活动编辑器段落
     */
    private generateActiveEditorSection(ignorePatterns: string[]): string {
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) {
            return ''
        }
        
        const uri = activeEditor.document.uri
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
        
        if (!workspaceFolder) {
            return ''
        }
        
        const relativePath = vscode.workspace.asRelativePath(uri, false)
        
        if (this.shouldIgnorePath(relativePath, ignorePatterns)) {
            return ''
        }
        
        return `Currently active file: ${relativePath}`
    }
    
    /**
     * 生成诊断信息段落
     *
     * 从 VSCode 获取工作区的诊断信息（错误、警告等）
     * 根据配置过滤严重程度和文件范围
     */
    private generateDiagnosticsSection(enabledOverride?: boolean): string {
        const settingsManager = getGlobalSettingsManager()
        if (!settingsManager) {
            return ''
        }
        
        const diagnosticsConfig = settingsManager.getDiagnosticsConfig()
        const diagnosticsEnabled = enabledOverride ?? diagnosticsConfig.enabled
        
        // 如果功能未启用，返回空
        if (!diagnosticsEnabled) {
            return ''
        }
        
        const workspaceFolders = vscode.workspace.workspaceFolders
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return ''
        }
        
        // 获取所有诊断信息
        const allDiagnostics = vscode.languages.getDiagnostics()
        
        // 严重程度映射
        const severityMap: Record<vscode.DiagnosticSeverity, 'error' | 'warning' | 'information' | 'hint'> = {
            [vscode.DiagnosticSeverity.Error]: 'error',
            [vscode.DiagnosticSeverity.Warning]: 'warning',
            [vscode.DiagnosticSeverity.Information]: 'information',
            [vscode.DiagnosticSeverity.Hint]: 'hint'
        }
        
        // 严重程度显示名称
        const severityLabels: Record<string, string> = {
            'error': 'Error',
            'warning': 'Warning',
            'information': 'Info',
            'hint': 'Hint'
        }
        
        // 获取打开的文件 URI 列表（如果需要只显示打开文件的诊断）
        const openFileUris = new Set<string>()
        if (diagnosticsConfig.openFilesOnly) {
            for (const tabGroup of vscode.window.tabGroups.all) {
                for (const tab of tabGroup.tabs) {
                    if (tab.input instanceof vscode.TabInputText) {
                        openFileUris.add(tab.input.uri.toString())
                    }
                }
            }
        }
        
        const fileResults: string[] = []
        let fileCount = 0
        
        for (const [uri, diagnostics] of allDiagnostics) {
            // 检查文件数量限制
            if (diagnosticsConfig.maxFiles !== -1 && fileCount >= diagnosticsConfig.maxFiles) {
                break
            }
            
            // 检查是否在工作区内
            if (diagnosticsConfig.workspaceOnly) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
                if (!workspaceFolder) {
                    continue
                }
            }
            
            // 如果只显示打开文件的诊断
            if (diagnosticsConfig.openFilesOnly && !openFileUris.has(uri.toString())) {
                continue
            }
            
            // 过滤诊断信息
            const filteredDiagnostics = diagnostics
                .filter(d => {
                    const severity = severityMap[d.severity]
                    return diagnosticsConfig.includeSeverities.includes(severity)
                })
                .slice(0, diagnosticsConfig.maxDiagnosticsPerFile === -1 ? undefined : diagnosticsConfig.maxDiagnosticsPerFile)
            
            if (filteredDiagnostics.length > 0) {
                const relativePath = vscode.workspace.asRelativePath(uri, false)
                const lines: string[] = []
                
                for (const d of filteredDiagnostics) {
                    const severity = severityMap[d.severity]
                    const severityLabel = severityLabels[severity]
                    const line = d.range.start.line + 1 // 转为 1-based 行号
                    const source = d.source ? ` (${d.source})` : ''
                    lines.push(`  Line ${line}: [${severityLabel}] ${d.message}${source}`)
                }
                
                fileResults.push(`${relativePath}:\n${lines.join('\n')}`)
                fileCount++
            }
        }
        
        if (fileResults.length === 0) {
            return ''
        }
        
        return `The following diagnostics were found in the workspace:\n\n${fileResults.join('\n\n')}`
    }
    
    /**
     * 生成固定文件内容段落
     *
     * 按工作区过滤固定文件，支持多工作区场景
     */
    private generatePinnedFilesSection(): string {
        const settingsManager = getGlobalSettingsManager()
        if (!settingsManager) {
            return ''
        }
        
        const workspaceFolders = vscode.workspace.workspaceFolders
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return ''
        }
        
        const results: string[] = []
        
        // 遍历所有工作区，获取每个工作区的固定文件
        for (const workspaceFolder of workspaceFolders) {
            const workspaceUri = workspaceFolder.uri.toString()
            const pinnedFiles = settingsManager.getEnabledPinnedFilesForWorkspace(workspaceUri)
            
            for (const pinnedFile of pinnedFiles) {
                try {
                    let filePath = pinnedFile.path
                    let fullPath: string
                    
                    // 判断是相对路径还是绝对路径
                    if (path.isAbsolute(filePath)) {
                        fullPath = filePath
                    } else {
                        // 相对路径，基于当前工作区根目录
                        fullPath = path.join(workspaceFolder.uri.fsPath, filePath)
                    }
                    
                    // 检查文件是否存在
                    if (!fs.existsSync(fullPath)) {
                        // 文件不存在时不添加到结果，也不报错
                        // 这样文件被删除后不会影响 AI 响应
                        continue
                    }
                    
                    // 读取文件内容
                    const content = fs.readFileSync(fullPath, 'utf-8')
                    
                    // 多工作区时显示工作区名称前缀
                    const displayPath = workspaceFolders.length > 1
                        ? `${workspaceFolder.name}/${pinnedFile.path}`
                        : pinnedFile.path
                    
                    // 添加到结果
                    results.push(`--- ${displayPath} ---\n${content}`)
                } catch (error: any) {
                    // 读取错误时静默跳过
                    console.warn(`Failed to read pinned file ${pinnedFile.path}:`, error.message)
                }
            }
        }
        
        if (results.length === 0) {
            return ''
        }
        
        return `The following are pinned files that should be read and considered for every response:\n\n${results.join('\n\n')}`
    }
    
    /**
     * 检查路径是否应该被忽略
     */
    private shouldIgnorePath(relativePath: string, ignorePatterns: string[]): boolean {
        for (const pattern of ignorePatterns) {
            if (this.matchGlobPattern(relativePath, pattern)) {
                return true
            }
        }
        return false
    }
    
    /**
     * 简单的 glob 模式匹配
     */
    private matchGlobPattern(path: string, pattern: string): boolean {
        const regexPattern = pattern
            .replace(/\\/g, '/')
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '<<<GLOBSTAR>>>')
            .replace(/\*/g, '[^/]*')
            .replace(/<<<GLOBSTAR>>>/g, '.*')
            .replace(/\//g, '[/\\\\]')
        
        const regex = new RegExp(`^${regexPattern}$|[/\\\\]${regexPattern}$|^${regexPattern}[/\\\\]|[/\\\\]${regexPattern}[/\\\\]`, 'i')
        return regex.test(path.replace(/\\/g, '/'))
    }
    
    /**
     * 获取上下文信息
     */
    private getContext(): PromptContext {
        const now = new Date()
        
        return {
            workspaceRoot: getWorkspaceRoot(),
            currentTime: now.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            os: this.getOSInfo()
        }
    }
    
    /**
     * 获取操作系统信息
     */
    private getOSInfo(): string {
        const platform = os.platform()
        const release = os.release()
        
        switch (platform) {
            case 'win32':
                return `Windows ${release}`
            case 'darwin':
                return `macOS ${release}`
            case 'linux':
                return `Linux ${release}`
            default:
                return `${platform} ${release}`
        }
    }
    
    /**
     * 检查是否需要刷新（用于首条消息判断）
     * 
     * @param isFirstMessage 是否是对话的第一条用户消息
     * @returns 是否需要刷新系统提示词
     */
    shouldRefresh(isFirstMessage: boolean): boolean {
        return isFirstMessage
    }
}

// 导出单例创建函数
let globalPromptManager: PromptManager | null = null

export function getPromptManager(): PromptManager {
    if (!globalPromptManager) {
        globalPromptManager = new PromptManager()
    }
    return globalPromptManager
}

export function setPromptManager(manager: PromptManager): void {
    globalPromptManager = manager
}

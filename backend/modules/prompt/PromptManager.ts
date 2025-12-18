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
import type { PromptConfig, PromptContext, PromptSection, DEFAULT_PROMPT_CONFIG } from './types'
import { getWorkspaceFileTree, getWorkspaceRoot, getWorkspacesDescription, getAllWorkspaces } from './fileTree'
import { getGlobalSettingsManager } from '../../core/settingsContext'

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
            maxDepth: 10,
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
    getSystemPrompt(forceRefresh: boolean = false): string {
        const now = Date.now()
        
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
    refreshAndGetPrompt(): string {
        return this.getSystemPrompt(true)
    }
    
    /**
     * 生成系统提示词
     *
     * 支持两种模式：
     * 1. 自定义模板模式：使用用户配置的模板，通过 {{MODULE}} 占位符引用模块
     * 2. 默认模式：按优先级顺序组装各模块
     */
    private generatePrompt(): string {
        const settingsManager = getGlobalSettingsManager()
        const promptConfig = settingsManager?.getSystemPromptConfig()
        
        // 如果启用了自定义模板，使用模板化生成
        if (promptConfig?.enabled && promptConfig.template) {
            return this.generateFromTemplate(promptConfig.template, promptConfig.customPrefix, promptConfig.customSuffix)
        }
        
        // 否则使用默认的段落式组装
        return this.generateDefaultPrompt()
    }
    
    /**
     * 从模板生成系统提示词
     *
     * 支持的占位符（使用 {{$xxx}} 格式）：
     * - {{$ENVIRONMENT}} - 环境信息
     * - {{$WORKSPACE_FILES}} - 工作区文件树
     * - {{$OPEN_TABS}} - 打开的标签页
     * - {{$ACTIVE_EDITOR}} - 当前活动编辑器
     * - {{$PINNED_FILES}} - 固定文件内容
     * - {{$TOOLS}} - 工具定义（由外部填充）
     * - {{$MCP_TOOLS}} - MCP 工具定义（由外部填充）
     */
    private generateFromTemplate(template: string, customPrefix: string, customSuffix: string): string {
        const contextConfig = getGlobalSettingsManager()?.getContextAwarenessConfig()
        
        // 生成各模块内容
        const modules: Record<string, string> = {
            'ENVIRONMENT': this.wrapSection('ENVIRONMENT', this.generateEnvironmentSection()),
            'WORKSPACE_FILES': (contextConfig?.includeWorkspaceFiles ?? this.config.includeWorkspaceFiles)
                ? this.wrapSection('WORKSPACE FILES', this.generateFileTreeSection(
                    contextConfig?.maxFileDepth ?? this.config.maxDepth ?? 10,
                    contextConfig?.ignorePatterns ?? []
                ))
                : '',
            'OPEN_TABS': contextConfig?.includeOpenTabs
                ? this.wrapSection('OPEN TABS', this.generateOpenTabsSection(
                    contextConfig.maxOpenTabs,
                    contextConfig.ignorePatterns || []
                ))
                : '',
            'ACTIVE_EDITOR': contextConfig?.includeActiveEditor
                ? this.wrapSection('ACTIVE EDITOR', this.generateActiveEditorSection(
                    contextConfig.ignorePatterns || []
                ))
                : '',
            'PINNED_FILES': this.wrapSection(
                getGlobalSettingsManager()?.getPinnedFilesConfig()?.sectionTitle || 'PINNED FILES CONTENT',
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
     * 默认的段落式组装（原有逻辑）
     */
    private generateDefaultPrompt(): string {
        const sections: PromptSection[] = []
        
        // 1. 自定义前缀
        if (this.config.prefix) {
            sections.push({
                id: 'prefix',
                content: this.config.prefix,
                priority: 0
            })
        }
        
        // 2. 环境信息段落
        const envSection = this.generateEnvironmentSection()
        if (envSection) {
            sections.push({
                id: 'environment',
                title: 'ENVIRONMENT',
                content: envSection,
                priority: 10
            })
        }
        
        // 3. 工作区文件树段落（根据上下文感知配置）
        const contextConfig = getGlobalSettingsManager()?.getContextAwarenessConfig()
        
        if (contextConfig?.includeWorkspaceFiles ?? this.config.includeWorkspaceFiles) {
            const maxDepth = contextConfig?.maxFileDepth ?? this.config.maxDepth ?? 10
            const ignorePatterns = contextConfig?.ignorePatterns ?? []
            const fileTreeSection = this.generateFileTreeSection(maxDepth, ignorePatterns)
            if (fileTreeSection) {
                sections.push({
                    id: 'workspace_files',
                    title: 'WORKSPACE FILES',
                    content: fileTreeSection,
                    priority: 20
                })
            }
        }
        
        // 4. 打开的标签页段落
        if (contextConfig?.includeOpenTabs) {
            const openTabsSection = this.generateOpenTabsSection(contextConfig.maxOpenTabs, contextConfig.ignorePatterns || [])
            if (openTabsSection) {
                sections.push({
                    id: 'open_tabs',
                    title: 'OPEN TABS',
                    content: openTabsSection,
                    priority: 25
                })
            }
        }
        
        // 5. 当前活动编辑器段落
        if (contextConfig?.includeActiveEditor) {
            const activeEditorSection = this.generateActiveEditorSection(contextConfig.ignorePatterns || [])
            if (activeEditorSection) {
                sections.push({
                    id: 'active_editor',
                    title: 'ACTIVE EDITOR',
                    content: activeEditorSection,
                    priority: 15
                })
            }
        }
        
        // 6. 固定文件内容段落
        const pinnedFilesSection = this.generatePinnedFilesSection()
        if (pinnedFilesSection) {
            const pinnedFilesConfig = getGlobalSettingsManager()?.getPinnedFilesConfig()
            const sectionTitle = pinnedFilesConfig?.sectionTitle || 'PINNED FILES CONTENT'
            sections.push({
                id: 'pinned_files',
                title: sectionTitle,
                content: pinnedFilesSection,
                priority: 30
            })
        }
        
        // 7. 自定义后缀
        if (this.config.suffix) {
            sections.push({
                id: 'suffix',
                content: this.config.suffix,
                priority: 100
            })
        }
        
        // 按优先级排序
        sections.sort((a, b) => (a.priority || 0) - (b.priority || 0))
        
        // 组装最终提示词
        return this.assembleSections(sections)
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
        
        // 用户语言环境
        const userLanguage = this.getUserLanguage()
        if (userLanguage) {
            lines.push(`User Language: ${userLanguage}`)
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
     * 组装段落
     */
    private assembleSections(sections: PromptSection[]): string {
        const parts: string[] = []
        
        for (const section of sections) {
            if (!section.content) {
                continue
            }
            
            if (section.title) {
                parts.push(`====\n\n${section.title}\n\n${section.content}`)
            } else {
                parts.push(section.content)
            }
        }
        
        return parts.join('\n\n')
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
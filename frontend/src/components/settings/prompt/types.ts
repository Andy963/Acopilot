export type ChannelType = 'gemini' | 'openai' | 'anthropic'

export interface PromptModule {
  id: string
  name: string
  description: string
  example?: string
  requiresConfig?: string
}

export interface SkillDefinition {
  id: string
  name: string
  description?: string
  prompt: string
}

export interface SystemPromptConfig {
  template: string
  customPrefix: string
  customSuffix: string
  skills?: SkillDefinition[]
}

export interface InstallSkillsSummary {
  found: number
  installed: number
  skippedExisting: number
  invalid: number
}

export interface InstallSkillsFromUrlResult {
  skills?: SkillDefinition[]
  summary?: InstallSkillsSummary
  skippedExisting?: string[]
}

export const CHANNEL_OPTIONS: { value: ChannelType; label: string }[] = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' }
]

export const AVAILABLE_PROMPT_MODULES: PromptModule[] = [
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
    id: 'PINNED_PROMPTS',
    name: '固定提示词',
    description: '显示当前对话启用的固定提示词块。可用 {{$PINNED_PROMPT:<id>}} 放置指定提示词',
    example: `====

PINNED PROMPT: Review

Review code carefully.`,
    requiresConfig: '需要在输入框旁的固定内容面板中添加提示词'
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
  }
]

export const DEFAULT_TEMPLATE = `You are a professional programming assistant, proficient in multiple programming languages and frameworks.

{{$ENVIRONMENT}}

{{$WORKSPACE_FILES}}

{{$OPEN_TABS}}

{{$ACTIVE_EDITOR}}

{{$DIAGNOSTICS}}

{{$PINNED_FILES}}

{{$PINNED_PROMPTS}}

{{$TOOLS}}

====

GUIDELINES

- Use the provided tools to complete tasks. Tools can help you read files, search code, execute commands, and modify files.
- **IMPORTANT: Avoid duplicate tool calls.** Each tool should only be called once with the same parameters. Never repeat the same tool call multiple times.
- When you need to understand the codebase, use read_file to examine specific files or search_in_files to find relevant code patterns.
- When you need to make changes, use apply_diff for targeted modifications or write_file for creating new files.
- If the task is simple and doesn't require tools, just respond directly without calling any tools.
- Always maintain code readability and maintainability.
- Do not omit any code.`

export function normalizeSkills(raw: unknown): SkillDefinition[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((skill): skill is Record<string, unknown> => !!skill && typeof skill === 'object')
    .map((skill) => ({
      id: String(skill.id || '').trim(),
      name: String(skill.name || '').trim(),
      description: typeof skill.description === 'string' ? skill.description : '',
      prompt: String(skill.prompt || '')
    }))
    .filter(skill => skill.id)
}

export function sortSkills(skills: SkillDefinition[]): SkillDefinition[] {
  return [...skills].sort((a, b) => {
    const nameCmp = (a.name || a.id).localeCompare(b.name || b.id)
    if (nameCmp !== 0) return nameCmp
    return a.id.localeCompare(b.id)
  })
}

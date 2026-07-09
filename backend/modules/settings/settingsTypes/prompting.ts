export interface PromptModule {
    id: string;
    name: string;
    description: string;
    example?: string;
    requiresConfig?: string;
}

export interface SkillDefinition {
    id: string;
    name: string;
    description?: string;
    prompt: string;
    [key: string]: unknown;
}

export interface PinnedPromptPreset {
    id: string;
    name: string;
    prompt: string;
    createdAt?: number;
    updatedAt?: number;
    [key: string]: unknown;
}

export type PinnedPromptWorkspaceDefault =
    | {
        mode: 'skill';
        skillId: string;
    }
    | {
        mode: 'preset';
        presetId: string;
    };

export interface SystemPromptConfig {
    template: string;
    customPrefix: string;
    customSuffix: string;
    skills?: SkillDefinition[];
    pinnedPromptPresets?: PinnedPromptPreset[];
    pinnedPromptWorkspaceDefaults?: Record<string, PinnedPromptWorkspaceDefault>;
    [key: string]: unknown;
}

export const AVAILABLE_PROMPT_MODULES: PromptModule[] = [
    {
        id: 'ENVIRONMENT',
        name: 'Environment Info',
        description: 'Contains workspace path, operating system, current time, timezone, and user language',
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
        name: 'Workspace Files',
        description: 'Lists files and directory structure in the workspace, affected by context awareness settings',
        example: `====

WORKSPACE FILES

The following is a list of files in the current workspace:

src/
  main.ts
  utils/
    helper.ts`,
        requiresConfig: 'Context Awareness > Send Workspace Files'
    },
    {
        id: 'OPEN_TABS',
        name: 'Open Tabs',
        description: 'Lists currently open file tabs in the editor',
        example: `====

OPEN TABS

Currently open files in editor:
  - src/main.ts
  - src/utils/helper.ts`,
        requiresConfig: 'Context Awareness > Send Open Tabs'
    },
    {
        id: 'ACTIVE_EDITOR',
        name: 'Active Editor',
        description: 'Shows the currently active file path',
        example: `====

ACTIVE EDITOR

Currently active file: src/main.ts`,
        requiresConfig: 'Context Awareness > Send Active Editor'
    },
    {
        id: 'DIAGNOSTICS',
        name: 'Diagnostics',
        description: 'Shows VSCode diagnostics (errors, warnings, hints) from the workspace',
        example: `====

DIAGNOSTICS

The following diagnostics were found in the workspace:

src/main.ts:
  Line 10: [Error] Cannot find name 'foo'.
  Line 25: [Warning] 'bar' is declared but never used.

src/utils/helper.ts:
  Line 5: [Error] Property 'x' does not exist on type 'Y'.`,
        requiresConfig: 'Context Awareness > Diagnostics'
    },
    {
        id: 'PINNED_FILES',
        name: 'Pinned Files Content',
        description: 'Shows full content of user-pinned files',
        example: `====

PINNED FILES CONTENT

The following are pinned files...

--- README.md ---
# Project Title
...`,
        requiresConfig: 'Add files via the pinned files button next to input'
    },
    {
        id: 'PINNED_PROMPTS',
        name: 'Pinned Prompts',
        description: 'Shows active pinned prompt blocks for the conversation. Use {{$PINNED_PROMPT:<id>}} to place one prompt by id.',
        example: `====

PINNED PROMPT: Review

Review code carefully.`,
        requiresConfig: 'Add prompts via the pinned context button next to input'
    },
    {
        id: 'TOOLS',
        name: 'Tools Definition',
        description: 'Generates tool definitions in XML or Function Call format based on channel config',
        example: `====

TOOLS

You have access to these tools:

## read_file
Description: Read file content
...`
    },
    {
        id: 'MCP_TOOLS',
        name: 'MCP Tools',
        description: 'Additional tool definitions from MCP servers',
        example: `====

MCP TOOLS

Additional tools from MCP servers:
...`,
        requiresConfig: 'Configure and connect servers in MCP Settings'
    }
];

export const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `You are a professional programming assistant, proficient in multiple programming languages and frameworks.

{{$WORKSPACE_FILES}}

{{$PINNED_FILES}}

{{$PINNED_PROMPTS}}

{{$TOOLS}}

{{$MCP_TOOLS}}

{{$ENVIRONMENT}}

{{$ACTIVE_EDITOR}}

{{$DIAGNOSTICS}}

====

GUIDELINES

- Use the provided tools to complete tasks. Tools can help you read files, search code, execute commands, and modify files.
- **IMPORTANT: Avoid duplicate tool calls.** Each tool should only be called once with the same parameters. Never repeat the same tool call multiple times.
- When you need to understand the codebase, prefer search_in_files/find_files/get_symbols first to narrow down the relevant files/lines, then use read_file to inspect only what you need.
- **Batch file reads.** If you expect to read multiple files, call read_file ONCE and include all targets in the files array (split into a few batched calls only if the list is very large).
- Use startLine/endLine ONLY when you have precise line numbers. Do not guess line ranges.
- When you need to make changes, use apply_diff for targeted modifications or write_file for creating new files.
- If the task is simple and doesn't require tools, just respond directly without calling any tools.
- Always maintain code readability and maintainability.
- Do not omit any code.`;

export const DEFAULT_SYSTEM_PROMPT_CONFIG: SystemPromptConfig = {
    template: DEFAULT_SYSTEM_PROMPT_TEMPLATE,
    customPrefix: '',
    customSuffix: '',
    skills: [],
    pinnedPromptPresets: [],
    pinnedPromptWorkspaceDefaults: {}
};

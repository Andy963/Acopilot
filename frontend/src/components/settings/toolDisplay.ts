export interface ToolDisplayInfo {
  name: string
  description: string
  category?: string
}

export type TranslateFunction = (key: string, params?: Record<string, any>) => string

export function isMcpTool(tool: ToolDisplayInfo): boolean {
  return tool.category === 'mcp' || tool.name.startsWith('mcp__')
}

export function getToolDisplayName(tool: ToolDisplayInfo | string): string {
  const name = typeof tool === 'string' ? tool : tool.name

  if ((typeof tool === 'string' && name.startsWith('mcp__')) || (typeof tool !== 'string' && isMcpTool(tool))) {
    const parts = name.split('__')
    const originalName = parts[2] || name
    return formatToolName(originalName)
  }

  return formatToolName(name)
}

export function getLocalizedToolDescription(
  tool: ToolDisplayInfo,
  translate: TranslateFunction,
): string {
  if (isMcpTool(tool)) return tool.description

  const key = getToolDescriptionKey(tool.name)
  const translated = translate(key)
  return translated === key ? tool.description : translated
}

export function getToolDescriptionKey(toolName: string): string {
  return `components.settings.toolsSettings.descriptions.${toolName}`
}

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

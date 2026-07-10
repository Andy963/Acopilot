export interface ToolDisplayInfo {
  name: string
  description: string
  category?: string
}

export type TranslateFunction = (key: string, params?: Record<string, any>) => string

export function getToolDisplayName(tool: ToolDisplayInfo | string): string {
  const name = typeof tool === 'string' ? tool : tool.name
  return formatToolName(name)
}

export function getLocalizedToolDescription(
  tool: ToolDisplayInfo,
  translate: TranslateFunction,
): string {
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

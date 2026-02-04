import type { ToolDeclaration } from '../../../../tools/types';

export function convertAnthropicTools(tools: ToolDeclaration[] | undefined): any[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}


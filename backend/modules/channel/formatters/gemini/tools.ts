import type { ToolDeclaration } from '../../../../tools/types';

export function convertGeminiTools(tools: ToolDeclaration[] | undefined): any[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  const functionDeclarations = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  return [
    {
      functionDeclarations,
    },
  ];
}


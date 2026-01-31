import type { Content } from '../../conversation/types';
import type { ToolDeclaration } from '../../../tools/types';

export function convertOpenAIThoughtSignatures(history: Content[]): Content[] {
    return history.map(content => ({
        role: content.role,
        parts: content.parts.map(part => {
            if (part.thoughtSignatures) {
                const { thoughtSignatures, ...restPart } = part;
                return restPart;
            }
            return part;
        })
    }));
}

export function convertOpenAITools(tools: ToolDeclaration[]): any {
    if (!tools || tools.length === 0) {
        return undefined;
    }

    return tools.map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            strict: false
        }
    }));
}

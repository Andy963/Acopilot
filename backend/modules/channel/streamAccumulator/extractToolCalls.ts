import type { ContentPart } from '../../conversation/types';
import type { ToolMode } from '../../config/configs/base';

import { parseXMLToolCalls } from '../../../tools/xmlFormatter';

const TOOL_CALL_START = '<<<TOOL_CALL>>>';
const TOOL_CALL_END = '<<<END_TOOL_CALL>>>';

const XML_TOOL_START = '<tool_use>';
const XML_TOOL_END = '</tool_use>';

export function extractToolCallsFromParts(params: { toolMode: ToolMode; parts: ContentPart[] }): ContentPart[] {
    const { toolMode, parts } = params;

    if (toolMode === 'function_call') {
        return parts;
    }

    const newParts: ContentPart[] = [];

    for (const part of parts) {
        if (!('text' in part)) {
            newParts.push(part);
            continue;
        }

        const hasJsonMarker = toolMode === 'json' && part.text.includes(TOOL_CALL_START);
        const hasXmlMarker = toolMode === 'xml' && part.text.includes(XML_TOOL_START);

        if (!hasJsonMarker && !hasXmlMarker) {
            newParts.push(part);
            continue;
        }

        let text = part.text;
        const isThought = part.thought === true;

        while (true) {
            if (toolMode === 'json') {
                const jsonStartIdx = text.indexOf(TOOL_CALL_START);
                const jsonEndIdx = text.indexOf(TOOL_CALL_END);

                if (jsonStartIdx === -1 || jsonEndIdx === -1 || jsonEndIdx <= jsonStartIdx) {
                    break;
                }

                const textBefore = text.substring(0, jsonStartIdx).trim();
                if (textBefore) {
                    newParts.push(isThought ? { text: textBefore, thought: true } : { text: textBefore });
                }

                const jsonStart = jsonStartIdx + TOOL_CALL_START.length;
                const jsonStr = text.substring(jsonStart, jsonEndIdx).trim();

                try {
                    const toolCall = JSON.parse(jsonStr);
                    if (toolCall.tool && toolCall.parameters) {
                        newParts.push({
                            functionCall: {
                                name: toolCall.tool,
                                args: toolCall.parameters,
                                id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
                            }
                        });
                    } else {
                        newParts.push({ text: text.substring(jsonStartIdx, jsonEndIdx + TOOL_CALL_END.length) });
                    }
                } catch {
                    newParts.push({ text: text.substring(jsonStartIdx, jsonEndIdx + TOOL_CALL_END.length) });
                }

                text = text.substring(jsonEndIdx + TOOL_CALL_END.length);
            } else if (toolMode === 'xml') {
                const xmlStartIdx = text.indexOf(XML_TOOL_START);
                const xmlEndIdx = text.indexOf(XML_TOOL_END);

                if (xmlStartIdx === -1 || xmlEndIdx === -1 || xmlEndIdx <= xmlStartIdx) {
                    break;
                }

                const textBefore = text.substring(0, xmlStartIdx).trim();
                if (textBefore) {
                    newParts.push(isThought ? { text: textBefore, thought: true } : { text: textBefore });
                }

                const xmlContent = text.substring(xmlStartIdx, xmlEndIdx + XML_TOOL_END.length);

                try {
                    const xmlCalls = parseXMLToolCalls(xmlContent);
                    if (xmlCalls.length > 0) {
                        for (const xmlCall of xmlCalls) {
                            newParts.push({
                                functionCall: {
                                    name: xmlCall.name,
                                    args: xmlCall.args,
                                    id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
                                }
                            });
                        }
                    } else {
                        newParts.push({ text: xmlContent });
                    }
                } catch {
                    newParts.push({ text: xmlContent });
                }

                text = text.substring(xmlEndIdx + XML_TOOL_END.length);
            } else {
                break;
            }
        }

        if (text) {
            newParts.push(isThought ? { text, thought: true } : { text });
        }
    }

    return newParts;
}


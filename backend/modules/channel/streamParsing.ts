/**
 * Acopilot - 流式响应解析工具
 *
 * 纯函数实现（不依赖 VSCode），用于解析不同提供商的流式返回格式。
 *
 * 支持：
 * - SSE (Server-Sent Events): 以空行分隔事件，事件内可包含多行 data:
 * - JSON 行/数组：逐行 JSON 对象或 JSON 数组的分片
 */

/**
 * 解析流式响应缓冲区
 *
 * 支持两种格式：
 * 1. SSE (Server-Sent Events): data: {...}\n\n (Gemini ?alt=sse, OpenAI, Anthropic)
 * 2. JSON 行/数组格式（逐步发送）
 */
export function parseStreamBuffer(
    buffer: string,
    final = false
): { chunks: any[]; remaining: string } {
    const chunks: any[] = [];

    // 先尝试按 SSE 解析：
    // - 兼容 SSE 注释/事件行（":" / "event:" / "id:" / "retry:"），避免 keep-alive 被误当作未知格式而无限累积
    // - 同时避免误判 JSON 内容中的 "data:"（要求出现在行首）
    const sseLinePattern = /(^|\r?\n)(data:|event:|id:|retry:|:)/;
    if (sseLinePattern.test(buffer)) {
        return parseSseStreamBuffer(buffer, final);
    }

    // 非 SSE：检测格式并解析 JSON
    const trimmedBuffer = buffer.trim();

    // JSON 格式：JSONL（每行一个完整 JSON 值）、数组分片（逐行元素），或单个（可能跨多行）JSON 值。
    if (trimmedBuffer.startsWith('{')) {
        const jsonlParsed = parseJsonLinesBuffer(buffer, final);
        if (jsonlParsed) {
            return jsonlParsed;
        }

        // Not JSONL: keep the entire buffer until it becomes a valid JSON value.
        try {
            const parsed = JSON.parse(trimmedBuffer);
            return { chunks: [parsed], remaining: '' };
        } catch {
            return { chunks: [], remaining: buffer };
        }
    }

    if (trimmedBuffer.startsWith('[')) {
        return parseJsonArrayFragmentsBuffer(buffer, final);
    }

    // 无法识别的格式，尝试直接解析为 JSON
    try {
        const parsed = JSON.parse(trimmedBuffer);
        return { chunks: [parsed], remaining: '' };
    } catch {
        // 保留等待更多数据
        return { chunks: [], remaining: buffer };
    }
}

function parseJsonLinesBuffer(
    buffer: string,
    final: boolean
): { chunks: any[]; remaining: string } | undefined {
    const lines = buffer.split('\n');
    const chunks: any[] = [];

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();
        if (!line) continue;

        try {
            chunks.push(JSON.parse(line));
        } catch {
            const tail = lines.slice(i).join('\n');

            // If we already parsed at least one line, we must not drop the unparsed tail.
            if (chunks.length > 0) {
                return { chunks, remaining: tail };
            }

            // If this looks like an incomplete last line, treat it as JSONL and keep it.
            if (i === lines.length - 1 && !final) {
                return { chunks, remaining: rawLine };
            }

            // Otherwise, this is likely a multiline JSON value (pretty-printed); let caller handle it.
            return undefined;
        }
    }

    return { chunks, remaining: '' };
}

function parseJsonArrayFragmentsBuffer(buffer: string, final: boolean): { chunks: any[]; remaining: string } {
    const chunks: any[] = [];
    const lines = buffer.split('\n');
    let remaining = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let jsonStr = line;
        if (jsonStr.startsWith('[')) {
            jsonStr = jsonStr.slice(1);
        }
        if (jsonStr.endsWith(']')) {
            jsonStr = jsonStr.slice(0, -1);
        }
        if (jsonStr.startsWith(',')) {
            jsonStr = jsonStr.slice(1);
        }
        if (jsonStr.endsWith(',')) {
            jsonStr = jsonStr.slice(0, -1);
        }
        jsonStr = jsonStr.trim();
        if (!jsonStr) continue;

        try {
            chunks.push(JSON.parse(jsonStr));
        } catch {
            const tail = lines.slice(i).join('\n');
            remaining = tail;
            break;
        }
    }

    if (remaining) {
        return { chunks, remaining };
    }

    return { chunks, remaining: '' };
}

function parseSseStreamBuffer(buffer: string, final: boolean): { chunks: any[]; remaining: string } {
    const chunks: any[] = [];

    // 统一换行符，便于按事件分割
    const normalized = buffer.replace(/\r\n/g, '\n');

    // SSE 事件以空行分隔（\n\n）
    const parts = normalized.split('\n\n');

    // 非 final：最后一段可能是不完整事件，保留为 remaining
    const remaining = final ? '' : (parts.pop() ?? '');

    // final：解析所有；非 final：只解析完整事件片段
    const eventBlocks = final ? parts : parts;

    for (const block of eventBlocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;

        const lines = block.split('\n');
        const dataLines: string[] = [];
        let eventName: string | undefined;

        for (const rawLine of lines) {
            if (!rawLine) continue;

            // 忽略 SSE 注释行（以 ":" 开头）
            if (rawLine.startsWith(':')) {
                continue;
            }

            // 记录事件名：部分提供商会把事件类型放在 event: 行，而不是 JSON 的 type 字段中
            if (rawLine.startsWith('event:')) {
                let value = rawLine.slice(6);
                if (value.startsWith(' ')) {
                    value = value.slice(1);
                }
                const name = value.trim();
                if (name) {
                    eventName = name;
                }
                continue;
            }

            // 仅提取 data: 行，其它如 event:/id:/retry: 等忽略
            if (!rawLine.startsWith('data:')) {
                continue;
            }

            let value = rawLine.slice(5);
            // SSE 规范：冒号后可有一个可选空格
            if (value.startsWith(' ')) {
                value = value.slice(1);
            }
            dataLines.push(value);
        }

        if (dataLines.length === 0) {
            continue;
        }

        const data = dataLines.join('\n').trim();
        if (!data) {
            continue;
        }

        // OpenAI / 部分 OpenAI-兼容网关使用 data: [DONE] 作为结束标记（可能不会再补一个带 finish_reason 的 JSON chunk）。
        // 为了让上层 StreamAccumulator/StreamResponseProcessor 能正确判断完成，这里透传一个内部 sentinel。
        if (data === '[DONE]') {
            chunks.push({ __acopilot_sse_done: true });
            continue;
        }

        try {
            const parsed = JSON.parse(data);
            if (
                eventName &&
                parsed &&
                typeof parsed === 'object' &&
                !Array.isArray(parsed) &&
                typeof (parsed as any).type !== 'string'
            ) {
                (parsed as any).type = eventName;
            }
            chunks.push(parsed);
        } catch {
            // 若解析失败：该事件块不是 JSON（或格式异常），直接忽略
        }
    }

    return { chunks, remaining: remaining || '' };
}

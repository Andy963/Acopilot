import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [],
  },
  window: {
    visibleTextEditors: [],
    activeTextEditor: undefined,
  },
  languages: {
    getDiagnostics: () => [],
  },
  env: {
    language: 'en',
  },
}));

import { DEFAULT_SYSTEM_PROMPT_TEMPLATE } from '../backend/modules/settings/settingsTypes/prompting';
import {
  appendConversationMessageSemantics,
  injectCurrentTurnContextIntoHistory
} from '../backend/modules/api/chat/services/toolIterationLoop/helpers';
import { PromptManager } from '../backend/modules/prompt';

describe('prompt context priority', () => {
  it('keeps conversation-message semantics outside the user-editable prompt template', () => {
    expect(DEFAULT_SYSTEM_PROMPT_TEMPLATE).not.toContain('CONVERSATION MESSAGE SEMANTICS');
    expect(DEFAULT_SYSTEM_PROMPT_TEMPLATE).not.toContain('The latest normal user message is the current task');
    expect(DEFAULT_SYSTEM_PROMPT_TEMPLATE).not.toContain('PRIOR CONVERSATION USER MESSAGE');
    expect(DEFAULT_SYSTEM_PROMPT_TEMPLATE).not.toContain('LATEST USER REQUEST');
    expect(DEFAULT_SYSTEM_PROMPT_TEMPLATE).toContain('{{$MCP_TOOLS}}');
  });

  it('injects conversation-message semantics into the actual system instruction', () => {
    const systemInstruction = appendConversationMessageSemantics('BASE SYSTEM PROMPT');

    expect(systemInstruction).toContain('BASE SYSTEM PROMPT');
    expect(systemInstruction).toContain('CONVERSATION MESSAGE SEMANTICS');
    expect(systemInstruction).toContain('All messages before the final user message are prior conversation history');
    expect(systemInstruction).toContain('LATEST USER REQUEST');
    expect(systemInstruction).toContain('follow the final user message');
  });

  it('applies custom system prompt prefix and suffix around the template output', () => {
    const manager = new PromptManager({ includeWorkspaceFiles: false });
    const rendered = (manager as any).generateFromTemplate('BASE TEMPLATE', 'CUSTOM PREFIX', 'CUSTOM SUFFIX');

    expect(rendered).toBe(['CUSTOM PREFIX', 'BASE TEMPLATE', 'CUSTOM SUFFIX'].join('\n\n'));
  });

  it('wraps current-turn context separately from the latest user request', () => {
    const requestHistory: any[] = [
      { role: 'user', parts: [{ text: 'Do not edit code.' }] },
      { role: 'model', parts: [{ text: 'OK.' }] },
      { role: 'user', parts: [{ text: 'Now implement the fix.' }] },
    ];

    const injected = injectCurrentTurnContextIntoHistory(requestHistory as any, {
      taskContext: 'PLAN MODE:\n- Produce a plan first.',
      openFileContext: '====\n\nOPEN FILE CONTEXT\n\n[1] src/a.ts\n```ts\nconst value = 1;\n```',
      selectionReferences: [
        {
          path: 'src/b.ts',
          startLine: 1,
          endLine: 1,
          languageId: 'ts',
          text: 'const selected = true;',
        } as any,
      ],
    });

    const text = injected[2].parts[0].text as string;

    expect(text).toContain('CURRENT TURN CONTEXT');
    expect(text).toContain('background information for the latest user request');
    expect(text).toContain('TASK CONTEXT');
    expect(text).toContain('OPEN FILE CONTEXT');
    expect(text).toContain('SELECTION REFERENCES');
    expect(text).toContain('LATEST USER REQUEST');
    expect(text).toContain('Now implement the fix.');
    expect(text).not.toContain('Do not edit code.');
    expect(text.indexOf('CURRENT TURN CONTEXT')).toBeLessThan(text.indexOf('LATEST USER REQUEST'));
    expect(text.trim().endsWith('Now implement the fix.')).toBe(true);

    expect(injected[0].parts[0].text).toBe('Do not edit code.');
  });

  it('keeps prior history unchanged and labels only the latest request without injected context', () => {
    const requestHistory: any[] = [
      { role: 'user', parts: [{ text: 'Do not write code.' }] },
      { role: 'model', parts: [{ text: 'Understood.' }] },
      { role: 'user', parts: [{ text: 'Now write the implementation.' }] },
    ];

    const injected = injectCurrentTurnContextIntoHistory(requestHistory as any, {});

    const priorText = injected[0].parts[0].text as string;
    const modelText = injected[1].parts[0].text as string;
    const latestText = injected[2].parts[0].text as string;

    expect(priorText).toBe('Do not write code.');
    expect(modelText).toBe('Understood.');
    expect(latestText).toContain('LATEST USER REQUEST');
    expect(latestText).toContain('Now write the implementation.');
    expect(latestText).not.toContain('CURRENT TURN CONTEXT');
    expect(latestText).not.toContain('Do not write code.');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  SymbolKind: {
    File: 0,
    Module: 1,
    Namespace: 2,
    Package: 3,
    Class: 4,
    Method: 5,
    Property: 6,
    Field: 7,
    Constructor: 8,
    Enum: 9,
    Interface: 10,
    Function: 11,
    Variable: 12,
    Constant: 13,
    String: 14,
    Number: 15,
    Boolean: 16,
    Array: 17,
    Object: 18,
    Key: 19,
    Null: 20,
    EnumMember: 21,
    Struct: 22,
    Event: 23,
    Operator: 24,
    TypeParameter: 25,
  },
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3,
  },
  FileType: {
    File: 1,
    Directory: 2,
  },
  ViewColumn: {
    One: 1,
    Beside: 2,
  },
  ConfigurationTarget: {
    Global: 1,
  },
  TextEditorRevealType: {
    InCenter: 0,
  },
  window: {
    showOpenDialog: vi.fn(),
    showWarningMessage: vi.fn(),
    showTextDocument: vi.fn(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    tabGroups: {
      all: [],
    },
  },
  commands: {
    executeCommand: vi.fn(),
  },
  languages: {
    getDiagnostics: vi.fn(() => []),
  },
  Uri: {
    file: (fsPath: string) => ({
      fsPath,
      toString: () => `file://${fsPath}`,
    }),
    parse: (value: string) => ({
      fsPath: value.replace(/^file:\/\//, ''),
      toString: () => value,
    }),
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => {
      const values = parts.map((part) => typeof part === 'string' ? part : part.fsPath || '');
      const fsPath = values.join('/').replace(/\/+/g, '/');
      return {
        fsPath,
        toString: () => `file://${fsPath}`,
      };
    },
  },
  workspace: {
    workspaceFolders: [],
    textDocuments: [],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      createDirectory: vi.fn(),
      delete: vi.fn(),
      readDirectory: vi.fn(),
    },
    openTextDocument: vi.fn(),
    applyEdit: vi.fn(),
    asRelativePath: vi.fn(),
    getWorkspaceFolder: vi.fn(),
    findFiles: vi.fn(),
    getConfiguration: vi.fn(() => ({
      update: vi.fn(),
    })),
    registerTextDocumentContentProvider: vi.fn(),
  },
  Position: class Position {
    constructor(public line: number, public character: number) {}
  },
  Range: class Range {
    constructor(public start: unknown, public end: unknown) {}
  },
  MarkdownString: class MarkdownString {},
  ThemeIcon: class ThemeIcon {
    constructor(public id: string) {}
  },
  Disposable: class Disposable {
    dispose(): void {}
  },
}));

import { MessageRouter } from '../webview/MessageRouter';
import type { HandlerContext, MessageHandler } from '../webview/types';

function createRouter(handlerType: string, handler: MessageHandler) {
  const sendResponse = vi.fn();
  const sendError = vi.fn();
  const router = Object.create(MessageRouter.prototype) as MessageRouter & {
    registry: Map<string, MessageHandler>;
    sendResponse: typeof sendResponse;
    sendError: typeof sendError;
  };

  router.registry = new Map([[handlerType, handler]]);
  router.sendResponse = sendResponse;
  router.sendError = sendError;

  return { router, sendResponse, sendError };
}

describe('MessageRouter guarded payload validation', () => {
  let ctx: HandlerContext;

  beforeEach(() => {
    ctx = {} as HandlerContext;
  });

  it.each([
    [
      'validation.runCommand',
      { conversationId: 'conv-1', toolCallId: 'tool-1', command: 123 },
      'validation.runCommand requires data.command (string)',
    ],
    [
      'storagePath.migrate',
      { path: 123 },
      'storagePath.migrate requires data.path (string)',
    ],
    [
      'tools.updateToolConfig',
      { toolName: 'locate', config: 'invalid' },
      'tools.updateToolConfig requires data.config (object)',
    ],
    [
      'tools.updateExecuteCommandConfig',
      { config: 'invalid' },
      'tools.updateExecuteCommandConfig requires data.config (object)',
    ],
  ])('rejects malformed %s before invoking the handler', async (type, data, errorMessage) => {
    const handler = vi.fn();
    const { router, sendError } = createRouter(type, handler);

    const handled = await router.route(type, data, 'req-1', ctx);

    expect(handled).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    expect(sendError).toHaveBeenCalledWith('req-1', 'INVALID_PAYLOAD', errorMessage);
  });

  it('forwards validated payloads to the handler', async () => {
    const handler = vi.fn();
    const { router, sendError } = createRouter('tools.updateToolConfig', handler);

    const handled = await router.route(
      'tools.updateToolConfig',
      { toolName: 'locate', config: { autoTriggerEnabled: true } },
      'req-2',
      ctx
    );

    expect(handled).toBe(true);
    expect(sendError).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(
      { toolName: 'locate', config: { autoTriggerEnabled: true } },
      'req-2',
      ctx
    );
  });
});

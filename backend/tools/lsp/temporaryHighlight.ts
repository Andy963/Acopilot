import * as vscode from 'vscode';

type HighlightState = {
  range: vscode.Range;
  updatedAt: number;
};

let initialized = false;
let decorationType: vscode.TextEditorDecorationType | undefined;
const highlightsByDoc = new Map<string, HighlightState>();

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  vscode.workspace.onDidCloseTextDocument((doc) => {
    highlightsByDoc.delete(doc.uri.toString());
  });

  vscode.window.onDidChangeVisibleTextEditors((editors) => {
    for (const editor of editors) {
      const state = highlightsByDoc.get(editor.document.uri.toString());
      if (state) {
        applyHighlightToEditor(editor, state.range);
      }
    }
  });
}

function getDecorationType(): vscode.TextEditorDecorationType {
  if (decorationType) return decorationType;

  decorationType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('editor.rangeHighlightBackground'),
    borderColor: new vscode.ThemeColor('editor.rangeHighlightBorder'),
    borderWidth: '1px',
    borderStyle: 'solid',
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.findMatchForeground'),
    overviewRulerLane: vscode.OverviewRulerLane.Center,
  });

  return decorationType;
}

function applyHighlightToEditor(editor: vscode.TextEditor, range: vscode.Range): void {
  const dt = getDecorationType();
  editor.setDecorations(dt, [range]);
}

export function setTemporaryEditorHighlight(
  editor: vscode.TextEditor,
  range: vscode.Range
): void {
  ensureInitialized();
  highlightsByDoc.set(editor.document.uri.toString(), { range, updatedAt: Date.now() });
  applyHighlightToEditor(editor, range);
}


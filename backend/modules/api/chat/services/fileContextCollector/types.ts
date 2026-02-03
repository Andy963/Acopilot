export type FileContextSkipReason =
  | 'not_found'
  | 'not_readable'
  | 'binary'
  | 'non_utf8'
  | 'empty'
  | 'read_error'
  | 'over_budget';

export interface OpenFileContextInput {
  /**
   * Human-friendly path that will be shown to the model (usually workspace-relative).
   *
   * This is intentionally decoupled from filesystem path to support multi-root workspaces
   * and non-file schemes.
   */
  path: string;
  /**
   * Optional absolute filesystem path used to read the file.
   */
  absolutePath?: string;
  /**
   * Optional URI string (e.g. vscode Uri.toString()).
   * If absolutePath is not provided, a file:// URI can be used to resolve the filesystem path.
   */
  uri?: string;
  /**
   * Optional language id for fenced code blocks.
   */
  languageId?: string;
  /**
   * Optional 1-based inclusive line range request.
   */
  startLine?: number;
  /**
   * Optional 1-based inclusive line range request.
   */
  endLine?: number;

  /**
   * Optional in-memory content (e.g. an unsaved editor buffer).
   *
   * When provided, the collector will not read from disk.
   */
  text?: string;

  /**
   * 1-based line number in the original file that corresponds to the first line of `text`.
   *
   * This allows callers to provide a partial buffer (e.g. a selection range) while keeping
   * the displayed line numbers accurate.
   */
  textStartLine?: number;
}

export interface FileContextCollectorOptions {
  /**
   * Maximum number of open files to consider (after de-duplication).
   */
  maxFiles?: number;
  /**
   * Maximum bytes read from disk per file. Large files will be read as head-only and marked truncated.
   */
  maxBytesPerFile?: number;
  /**
   * Maximum number of lines included per file (after applying requested line range).
   */
  maxLinesPerFile?: number;
  /**
   * Maximum characters included per file (after applying line constraints).
   */
  maxCharsPerFile?: number;
  /**
   * Maximum total characters included across all files. Remaining files will be skipped with "over_budget".
   */
  maxTotalChars?: number;
  /**
   * If true, include empty files as an empty fenced block. Default: false.
   */
  includeEmptyFiles?: boolean;
}

export interface CollectedFileContextItem {
  path: string;
  absolutePath?: string;
  uri?: string;
  languageId?: string;

  requestedStartLine?: number;
  requestedEndLine?: number;
  sourceText?: string;
  sourceTextStartLine?: number;

  included: boolean;
  skippedReason?: FileContextSkipReason;

  originalByteCount?: number;
  originalCharCount?: number;
  includedCharCount?: number;
  truncated?: boolean;

  startLine?: number;
  endLine?: number;

  content?: string;
}

export interface FileContextCollectorResult {
  items: CollectedFileContextItem[];
  includedCount: number;
  skippedCount: number;
  totalIncludedChars: number;
  block: string;
}

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.bmp', '.svg', '.ico', '.tiff',
  // Audio
  '.mp3', '.wav', '.aiff', '.aac', '.ogg', '.flac', '.m4a', '.wma',
  // Video
  '.mp4', '.mov', '.avi', '.wmv', '.webm', '.mkv', '.3gp', '.flv', '.m4v',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Archives / executables / fonts
  '.zip', '.rar', '.7z', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.ttf', '.otf', '.eot'
]);

function isBinaryByExtension(fsPath: string): boolean {
  const ext = path.extname(fsPath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

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

function normalizePositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0) return undefined;
  return Math.floor(n);
}

function normalizeLineRange(input: OpenFileContextInput): { startLine?: number; endLine?: number } {
  const startLine = normalizePositiveInt(input.startLine);
  const endLine = normalizePositiveInt(input.endLine);

  if (startLine === undefined && endLine === undefined) return {};
  if (startLine !== undefined && endLine !== undefined) {
    return { startLine, endLine: Math.max(endLine, startLine) };
  }
  return { startLine, endLine };
}

function resolveFsPath(input: OpenFileContextInput): { fsPath?: string; scheme?: string } {
  if (typeof input.absolutePath === 'string' && input.absolutePath.trim()) {
    return { fsPath: path.resolve(input.absolutePath.trim()), scheme: 'file' };
  }

  if (typeof input.uri !== 'string' || !input.uri.trim()) {
    return { fsPath: undefined, scheme: undefined };
  }

  try {
    const url = new URL(input.uri);
    const scheme = url.protocol.replace(/:$/, '');
    if (scheme !== 'file') return { fsPath: undefined, scheme };
    return { fsPath: fileURLToPath(url), scheme };
  } catch {
    return { fsPath: undefined, scheme: undefined };
  }
}

function isLikelyBinaryContent(bytes: Uint8Array): boolean {
  const sampleSize = Math.min(bytes.length, 8000);
  if (sampleSize === 0) return false;

  let suspicious = 0;
  for (let i = 0; i < sampleSize; i++) {
    const b = bytes[i];
    if (b === 0) return true;
    const isAllowedWhitespace = b === 9 || b === 10 || b === 13;
    const isControl = b < 32 && !isAllowedWhitespace;
    if (isControl) suspicious++;
  }

  return suspicious / sampleSize > 0.2;
}

function decodeUtf8WithValidation(bytes: Uint8Array): { text: string; validUtf8: boolean; trimmedTailBytes: number } {
  // When we read head-only bytes, we may cut a multi-byte sequence.
  // Try trimming up to 3 tail bytes so valid UTF-8 files still decode as valid.
  const maxTrim = Math.min(3, Math.max(0, bytes.length - 1));
  for (let trim = 0; trim <= maxTrim; trim++) {
    const slice = trim > 0 ? bytes.slice(0, bytes.length - trim) : bytes;
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(slice);
      return { text, validUtf8: true, trimmedTailBytes: trim };
    } catch {
      // continue
    }
  }

  return {
    text: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
    validUtf8: false,
    trimmedTailBytes: 0
  };
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function splitLines(text: string): string[] {
  // Keep trailing empty line semantics stable across platforms.
  return text.split('\n');
}

function sliceByLineRange(
  lines: string[],
  range: { startLine?: number; endLine?: number },
  maxLines: number
): { sliced: string; startLine: number; endLine: number; truncated: boolean } {
  const totalLines = Math.max(1, lines.length);
  const requestedStart = range.startLine ?? 1;
  const requestedEnd = range.endLine ?? totalLines;

  const startLine = Math.min(Math.max(1, requestedStart), totalLines);
  const endLine = Math.min(Math.max(startLine, requestedEnd), totalLines);

  const requestedCount = endLine - startLine + 1;
  const effectiveCount = Math.min(requestedCount, maxLines);
  const effectiveEnd = startLine + effectiveCount - 1;

  const slicedLines = lines.slice(startLine - 1, effectiveEnd);
  return {
    sliced: slicedLines.join('\n'),
    startLine,
    endLine: effectiveEnd,
    truncated: effectiveCount < requestedCount
  };
}

function truncateByChars(text: string, maxChars: number): { text: string; truncated: boolean; originalCharCount: number } {
  const originalCharCount = text.length;
  if (originalCharCount <= maxChars) return { text, truncated: false, originalCharCount };
  const prefix = text.slice(0, maxChars);
  return { text: `${prefix}\n...(truncated, original ${originalCharCount} chars)`, truncated: true, originalCharCount };
}

function sanitizeFenceLanguage(languageId: string | undefined): string {
  if (!languageId) return '';
  return languageId.replace(/[^a-zA-Z0-9_+\\-]/g, '');
}

function longestBacktickRun(text: string): number {
  let best = 0;
  let current = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '`') {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

function buildFencedBlock(languageId: string | undefined, content: string): string {
  const lang = sanitizeFenceLanguage(languageId);
  const fenceLen = Math.max(3, longestBacktickRun(content) + 1);
  const fence = '`'.repeat(fenceLen);
  return lang ? `${fence}${lang}\n${content}\n${fence}` : `${fence}\n${content}\n${fence}`;
}

type HeadCacheEntry = {
  mtimeMs: number;
  size: number;
  bytes: Uint8Array;
  truncated: boolean;
  lastAccess: number;
};

const HEAD_CACHE_LIMIT = 64;
const headCache = new Map<string, HeadCacheEntry>();

function pruneHeadCacheIfNeeded(): void {
  if (headCache.size <= HEAD_CACHE_LIMIT) return;

  // Drop oldest entries to avoid unbounded growth.
  const entries = Array.from(headCache.entries());
  entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
  const toRemove = Math.max(0, headCache.size - HEAD_CACHE_LIMIT);
  for (let i = 0; i < toRemove; i++) {
    headCache.delete(entries[i][0]);
  }
}

async function readHeadBytes(
  fsPath: string,
  maxBytes: number
): Promise<{ bytes: Uint8Array; totalBytes: number; truncated: boolean }> {
  const stat = await fs.stat(fsPath);
  const totalBytes = stat.size;
  const mtimeMs = stat.mtimeMs;
  const readLen = Math.min(totalBytes, maxBytes);

  const cacheKey = `${fsPath}|${maxBytes}`;
  const cached = headCache.get(cacheKey);
  if (cached && cached.mtimeMs === mtimeMs && cached.size === totalBytes) {
    cached.lastAccess = Date.now();
    return { bytes: cached.bytes, totalBytes, truncated: cached.truncated };
  }

  const handle = await fs.open(fsPath, 'r');
  try {
    const buffer = Buffer.alloc(readLen);
    const { bytesRead } = await handle.read(buffer, 0, readLen, 0);
    const bytes = buffer.subarray(0, bytesRead);
    const truncated = bytesRead < totalBytes;

    headCache.set(cacheKey, {
      mtimeMs,
      size: totalBytes,
      bytes,
      truncated,
      lastAccess: Date.now(),
    });
    pruneHeadCacheIfNeeded();

    return { bytes, totalBytes, truncated };
  } finally {
    await handle.close();
  }
}

function normalizeInputs(inputs: OpenFileContextInput[], maxFiles: number): CollectedFileContextItem[] {
  const normalized: CollectedFileContextItem[] = [];
  for (const input of inputs) {
    if (!input || typeof input.path !== 'string' || !input.path.trim()) continue;

    const { startLine, endLine } = normalizeLineRange(input);
    const sourceTextStartLine = normalizePositiveInt(input.textStartLine);
    const { fsPath } = resolveFsPath(input);

    normalized.push({
      path: input.path.trim(),
      absolutePath: fsPath,
      uri: typeof input.uri === 'string' ? input.uri : undefined,
      languageId: typeof input.languageId === 'string' && input.languageId.trim() ? input.languageId.trim() : undefined,
      requestedStartLine: startLine,
      requestedEndLine: endLine,
      sourceText: typeof input.text === 'string' ? input.text : undefined,
      sourceTextStartLine,
      included: false
    });
  }

  // De-dup by (absolutePath||uri||path)+range, then sort to make output stable.
  const seen = new Set<string>();
  const deduped: CollectedFileContextItem[] = [];
  for (const item of normalized) {
    const keyBase = item.absolutePath || item.uri || item.path;
    const key = `${keyBase}#${item.requestedStartLine ?? ''}:${item.requestedEndLine ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    // Prefer explicit ranges over "whole file" to improve relevance and avoid budget waste.
    const aStart = a.requestedStartLine ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.requestedStartLine ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = a.requestedEndLine ?? Number.MAX_SAFE_INTEGER;
    const bEnd = b.requestedEndLine ?? Number.MAX_SAFE_INTEGER;
    if (aEnd !== bEnd) return aEnd - bEnd;
    const aLang = a.languageId ?? '';
    const bLang = b.languageId ?? '';
    if (aLang !== bLang) return aLang < bLang ? -1 : 1;
    const aAbs = a.absolutePath ?? '';
    const bAbs = b.absolutePath ?? '';
    if (aAbs !== bAbs) return aAbs < bAbs ? -1 : 1;
    return 0;
  });

  return deduped.slice(0, maxFiles);
}

function buildContextBlock(items: CollectedFileContextItem[]): string {
  const included = items.filter((i) => i.included && typeof i.content === 'string');
  const skipped = items.filter((i) => !i.included);

  const blocks: string[] = [];
  for (let i = 0; i < included.length; i++) {
    const item = included[i];
    const range = item.startLine && item.endLine ? `#L${item.startLine}-L${item.endLine}` : '';
    const lang = item.languageId ? ` (${item.languageId})` : '';
    const truncated = item.truncated ? ' (truncated)' : '';
    const header = `[${i + 1}] ${item.path}${range}${lang}${truncated}`;
    const fenced = buildFencedBlock(item.languageId, item.content || '');
    blocks.push([header, fenced].join('\n'));
  }

  const skippedLines: string[] = [];
  for (const item of skipped) {
    const reason = item.skippedReason || 'read_error';
    skippedLines.push(`- ${item.path} (${reason})`);
  }

  const sectionParts: string[] = [];
  if (blocks.length > 0) {
    sectionParts.push(blocks.join('\n\n'));
  }
  if (skippedLines.length > 0) {
    sectionParts.push(['SKIPPED FILES', ...skippedLines].join('\n'));
  }

  if (sectionParts.length === 0) return '';
  return `====\n\nOPEN FILE CONTEXT\n\n${sectionParts.join('\n\n')}`;
}

export class FileContextCollector {
  public async collect(
    inputs: OpenFileContextInput[],
    options: FileContextCollectorOptions = {}
  ): Promise<FileContextCollectorResult> {
    const maxFiles = normalizePositiveInt(options.maxFiles) ?? 10;
    const maxBytesPerFile = normalizePositiveInt(options.maxBytesPerFile) ?? 256 * 1024;
    const maxLinesPerFile = normalizePositiveInt(options.maxLinesPerFile) ?? 400;
    const maxCharsPerFile = normalizePositiveInt(options.maxCharsPerFile) ?? 12000;
    const maxTotalChars = normalizePositiveInt(options.maxTotalChars) ?? 30000;
    const includeEmptyFiles = options.includeEmptyFiles === true;

    const items = normalizeInputs(inputs, maxFiles);

    let totalChars = 0;
    for (const item of items) {
      if (totalChars >= maxTotalChars) {
        item.included = false;
        item.skippedReason = 'over_budget';
        continue;
      }

      if (typeof item.sourceText === 'string') {
        const normalizedText = normalizeNewlines(item.sourceText);

        if (!normalizedText) {
          if (includeEmptyFiles) {
            item.included = true;
            item.content = '';
            item.originalCharCount = 0;
            item.includedCharCount = 0;
            item.truncated = false;
          } else {
            item.included = false;
            item.skippedReason = 'empty';
          }
          continue;
        }

        const lines = splitLines(normalizedText);
        const baseLine = item.sourceTextStartLine ?? 1;
        const defaultEnd = baseLine + Math.max(1, lines.length) - 1;
        const fileRange = {
          startLine: item.requestedStartLine ?? baseLine,
          endLine: item.requestedEndLine ?? defaultEnd,
        };
        const relativeRange = {
          startLine: (fileRange.startLine ?? baseLine) - baseLine + 1,
          endLine: (fileRange.endLine ?? defaultEnd) - baseLine + 1,
        };
        const sliced = sliceByLineRange(lines, relativeRange, maxLinesPerFile);
        const truncatedByRange = sliced.truncated;

        const charTrunc = truncateByChars(sliced.sliced, maxCharsPerFile);
        const includedText = charTrunc.text;

        const remainingBudget = Math.max(0, maxTotalChars - totalChars);
        if (includedText.length > remainingBudget) {
          item.included = false;
          item.skippedReason = 'over_budget';
          continue;
        }

        item.included = includeEmptyFiles || includedText.trim().length > 0;
        if (!item.included) {
          item.skippedReason = 'empty';
          continue;
        }

        item.content = includedText;
        item.startLine = baseLine + sliced.startLine - 1;
        item.endLine = baseLine + sliced.endLine - 1;
        item.originalCharCount = normalizedText.length;
        item.includedCharCount = includedText.length;
        item.truncated = Boolean(truncatedByRange || charTrunc.truncated);

        totalChars += includedText.length;
        continue;
      }

      const fsPath = item.absolutePath;
      if (!fsPath) {
        item.included = false;
        item.skippedReason = 'not_readable';
        continue;
      }

      if (isBinaryByExtension(fsPath)) {
        item.included = false;
        item.skippedReason = 'binary';
        continue;
      }

      try {
        const { bytes, totalBytes, truncated } = await readHeadBytes(fsPath, maxBytesPerFile);
        item.originalByteCount = totalBytes;

        if (bytes.length === 0) {
          if (includeEmptyFiles) {
            item.included = true;
            item.content = '';
            item.originalCharCount = 0;
            item.includedCharCount = 0;
            item.truncated = false;
          } else {
            item.included = false;
            item.skippedReason = 'empty';
          }
          continue;
        }

        if (isLikelyBinaryContent(bytes)) {
          item.included = false;
          item.skippedReason = 'binary';
          continue;
        }

        const decoded = decodeUtf8WithValidation(bytes);
        if (!decoded.validUtf8) {
          item.included = false;
          item.skippedReason = 'non_utf8';
          continue;
        }

        const normalizedText = normalizeNewlines(decoded.text);
        const lines = splitLines(normalizedText);
        const range = { startLine: item.requestedStartLine, endLine: item.requestedEndLine };

        const sliced = sliceByLineRange(lines, range, maxLinesPerFile);
        const truncatedByRange = sliced.truncated;

        const charTrunc = truncateByChars(sliced.sliced, maxCharsPerFile);

        const includedText = charTrunc.text;

        const remainingBudget = Math.max(0, maxTotalChars - totalChars);
        if (includedText.length > remainingBudget) {
          // Do not partially include a file once we are over budget; it tends to confuse context.
          item.included = false;
          item.skippedReason = 'over_budget';
          continue;
        }

        item.included = includeEmptyFiles || includedText.trim().length > 0;
        if (!item.included) {
          item.skippedReason = 'empty';
          continue;
        }

        item.content = includedText;
        item.startLine = sliced.startLine;
        item.endLine = sliced.endLine;
        item.originalCharCount = normalizedText.length;
        item.includedCharCount = includedText.length;
        item.truncated = Boolean(truncated || decoded.trimmedTailBytes > 0 || truncatedByRange || charTrunc.truncated);

        totalChars += includedText.length;
      } catch (error: any) {
        const code = typeof error?.code === 'string' ? error.code : '';
        if (code === 'ENOENT') {
          item.included = false;
          item.skippedReason = 'not_found';
        } else {
          item.included = false;
          item.skippedReason = 'read_error';
        }
      }
    }

    const includedCount = items.filter((i) => i.included).length;
    const skippedCount = items.length - includedCount;
    const block = buildContextBlock(items);

    return {
      items,
      includedCount,
      skippedCount,
      totalIncludedChars: totalChars,
      block
    };
  }
}

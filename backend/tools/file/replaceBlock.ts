/**
 * Shared diff apply helpers (exact + fuzzy fallback).
 *
 * Used by:
 * - backend/tools/file/apply_diff.ts (tool execution)
 * - webview/handlers/PatchHandlers.ts (hunk apply/undo from UI)
 */

export type ReplaceBlockResult = {
  success: boolean;
  result: string;
  error?: string;
  matchCount: number;
  matchedLine?: number;
  appliedBy?: 'exact_start' | 'exact_global' | 'fuzzy_lines';
};

export type ReplaceBlockOptions = {
  /** 1-based line number; when provided we try from that line first */
  startLine?: number;
  /**
   * Enable fuzzy matching fallback when exact matching fails.
   * Default: true
   */
  enableFuzzy?: boolean;
  /**
   * When startLine is provided, fuzzy matching scans within +/- radius lines.
   * Default: derived from fromLines length.
   */
  fuzzyWindowRadiusLines?: number;
  /** Minimum `from` block size to allow fuzzy matching */
  fuzzyMinChars?: number;
  /** Minimum `from` line count to allow fuzzy matching */
  fuzzyMinLines?: number;
  /** Max mismatched lines allowed (after filtering ignorable lines) */
  fuzzyMaxMismatches?: number;
  /** Max mismatch ratio allowed */
  fuzzyMaxMismatchRatio?: number;
};

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function applyReplaceOnceExact(
  content: string,
  from: string,
  to: string,
  startLine?: number
): { success: boolean; result: string; error?: string; matchCount: number; matchedLine?: number } {
  const normalizedContent = normalizeLineEndings(content);
  const normalizedFrom = normalizeLineEndings(from);
  const normalizedTo = normalizeLineEndings(to);

  if (startLine !== undefined && Number.isFinite(startLine) && startLine > 0) {
    const lines = normalizedContent.split('\n');
    const startIndex = startLine - 1;
    if (startIndex >= lines.length) {
      return {
        success: false,
        result: normalizedContent,
        error: `Start line ${startLine} is out of range. File has ${lines.length} lines.`,
        matchCount: 0
      };
    }

    let charOffset = 0;
    for (let i = 0; i < startIndex; i++) {
      charOffset += lines[i].length + 1;
    }

    const contentFromStart = normalizedContent.substring(charOffset);
    const matchIndex = contentFromStart.indexOf(normalizedFrom);
    if (matchIndex === -1) {
      return {
        success: false,
        result: normalizedContent,
        error: `No exact match found starting from line ${startLine}.`,
        matchCount: 0
      };
    }

    const textBeforeMatch = normalizedContent.substring(0, charOffset + matchIndex);
    const actualMatchedLine = textBeforeMatch.split('\n').length;

    const result =
      normalizedContent.substring(0, charOffset + matchIndex) +
      normalizedTo +
      normalizedContent.substring(charOffset + matchIndex + normalizedFrom.length);

    return { success: true, result, matchCount: 1, matchedLine: actualMatchedLine };
  }

  const matches = normalizedContent.split(normalizedFrom).length - 1;
  if (matches === 0) {
    return {
      success: false,
      result: normalizedContent,
      error: 'No exact match found.',
      matchCount: 0
    };
  }
  if (matches > 1) {
    return {
      success: false,
      result: normalizedContent,
      error: `Multiple matches found (${matches}). Please provide start_line to disambiguate.`,
      matchCount: matches
    };
  }

  const matchIndex = normalizedContent.indexOf(normalizedFrom);
  const textBeforeMatch = normalizedContent.substring(0, matchIndex);
  const actualMatchedLine = textBeforeMatch.split('\n').length;

  return {
    success: true,
    result: normalizedContent.replace(normalizedFrom, normalizedTo),
    matchCount: 1,
    matchedLine: actualMatchedLine
  };
}

function isIgnorableLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('//')) return true;
  if (trimmed.startsWith('/*')) return true;
  if (trimmed === '*/') return true;
  if (trimmed.startsWith('*')) return true;
  return false;
}

function normalizeLineForCompare(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

function applyReplaceFuzzyByLines(
  content: string,
  from: string,
  to: string,
  options: Required<
    Pick<
      ReplaceBlockOptions,
      | 'startLine'
      | 'fuzzyWindowRadiusLines'
      | 'fuzzyMinChars'
      | 'fuzzyMinLines'
      | 'fuzzyMaxMismatches'
      | 'fuzzyMaxMismatchRatio'
    >
  >
): ReplaceBlockResult {
  const normalizedContent = normalizeLineEndings(content);
  const normalizedFrom = normalizeLineEndings(from);
  const normalizedTo = normalizeLineEndings(to);

  if (
    normalizedFrom.length < options.fuzzyMinChars ||
    normalizedFrom.split('\n').length < options.fuzzyMinLines
  ) {
    return {
      success: false,
      result: normalizedContent,
      error: 'Search block too small for fuzzy matching. Please provide an exact match.',
      matchCount: 0
    };
  }

  const contentLines = normalizedContent.split('\n');
  const fromLines = normalizedFrom.split('\n');
  const toLines = normalizedTo.split('\n');

  if (fromLines.length > contentLines.length) {
    return {
      success: false,
      result: normalizedContent,
      error: 'Search block is longer than file content.',
      matchCount: 0
    };
  }

  let scanStart = 0;
  let scanEnd = contentLines.length - fromLines.length;

  if (options.startLine && options.startLine > 0) {
    const center = Math.min(Math.max(options.startLine - 1, 0), contentLines.length - 1);
    const radius = Math.max(0, options.fuzzyWindowRadiusLines);
    scanStart = Math.max(0, center - radius);
    scanEnd = Math.min(contentLines.length - fromLines.length, center + radius);
  }

  type Candidate = {
    startIndex: number;
    mismatches: number;
    comparisons: number;
    mismatchRatio: number;
    distanceToStart: number;
  };

  let best: Candidate | null = null;
  let secondBest: Candidate | null = null;

  const startLineIndex = options.startLine && options.startLine > 0 ? options.startLine - 1 : -1;

  for (let i = scanStart; i <= scanEnd; i++) {
    let mismatches = 0;
    let comparisons = 0;

    for (let j = 0; j < fromLines.length; j++) {
      const a = fromLines[j] ?? '';
      const b = contentLines[i + j] ?? '';

      // Ignore pairs of ignorable lines (blank/comments) to tolerate comment drift.
      if (isIgnorableLine(a) && isIgnorableLine(b)) {
        continue;
      }

      comparisons++;
      if (normalizeLineForCompare(a) !== normalizeLineForCompare(b)) {
        mismatches++;
        if (mismatches > options.fuzzyMaxMismatches) {
          break;
        }
      }
    }

    if (comparisons === 0) continue;

    const mismatchRatio = mismatches / comparisons;
    if (mismatchRatio > options.fuzzyMaxMismatchRatio) continue;

    const distanceToStart = startLineIndex >= 0 ? Math.abs(i - startLineIndex) : 0;

    const candidate: Candidate = {
      startIndex: i,
      mismatches,
      comparisons,
      mismatchRatio,
      distanceToStart
    };

    const isBetter =
      !best ||
      candidate.mismatchRatio < best.mismatchRatio ||
      (candidate.mismatchRatio === best.mismatchRatio && candidate.mismatches < best.mismatches) ||
      (candidate.mismatchRatio === best.mismatchRatio &&
        candidate.mismatches === best.mismatches &&
        candidate.distanceToStart < best.distanceToStart);

    if (isBetter) {
      secondBest = best;
      best = candidate;
    } else {
      const isSecondBetter =
        !secondBest ||
        candidate.mismatchRatio < secondBest.mismatchRatio ||
        (candidate.mismatchRatio === secondBest.mismatchRatio &&
          candidate.mismatches < secondBest.mismatches) ||
        (candidate.mismatchRatio === secondBest.mismatchRatio &&
          candidate.mismatches === secondBest.mismatches &&
          candidate.distanceToStart < secondBest.distanceToStart);
      if (isSecondBetter) {
        secondBest = candidate;
      }
    }
  }

  if (!best) {
    return {
      success: false,
      result: normalizedContent,
      error: 'No fuzzy match found.',
      matchCount: 0
    };
  }

  // Ambiguity check: if there is another candidate equally good, refuse to apply.
  if (
    secondBest &&
    secondBest.mismatches === best.mismatches &&
    Math.abs(secondBest.mismatchRatio - best.mismatchRatio) < 1e-9
  ) {
    return {
      success: false,
      result: normalizedContent,
      error: 'Multiple similar matches found. Please provide a more specific search block.',
      matchCount: 2
    };
  }

  const nextLines = [
    ...contentLines.slice(0, best.startIndex),
    ...toLines,
    ...contentLines.slice(best.startIndex + fromLines.length)
  ];

  return {
    success: true,
    result: nextLines.join('\n'),
    matchCount: 1,
    matchedLine: best.startIndex + 1,
    appliedBy: 'fuzzy_lines'
  };
}

export function applyReplaceBlock(
  content: string,
  from: string,
  to: string,
  options: ReplaceBlockOptions = {}
): ReplaceBlockResult {
  const startLine =
    options.startLine !== undefined && Number.isFinite(options.startLine) ? options.startLine : undefined;

  const exactStart = startLine !== undefined ? applyReplaceOnceExact(content, from, to, startLine) : null;
  if (exactStart?.success) {
    return { ...exactStart, appliedBy: 'exact_start' };
  }

  const exactGlobal = applyReplaceOnceExact(content, from, to, undefined);
  if (exactGlobal.success) {
    return { ...exactGlobal, appliedBy: 'exact_global' };
  }

  const enableFuzzy = options.enableFuzzy !== false;
  if (!enableFuzzy) {
    // Prefer the startLine-specific error if provided for better UX.
    if (exactStart && exactStart.error) {
      return { ...exactStart, matchCount: exactGlobal.matchCount };
    }
    return exactGlobal;
  }

  const fromLineCount = normalizeLineEndings(from).split('\n').length;
  const fuzzyWindowRadiusLines =
    typeof options.fuzzyWindowRadiusLines === 'number'
      ? options.fuzzyWindowRadiusLines
      : Math.min(600, Math.max(80, fromLineCount * 6));

  const fuzzy = applyReplaceFuzzyByLines(content, from, to, {
    startLine: startLine ?? 0,
    fuzzyWindowRadiusLines,
    fuzzyMinChars: typeof options.fuzzyMinChars === 'number' ? options.fuzzyMinChars : 80,
    fuzzyMinLines: typeof options.fuzzyMinLines === 'number' ? options.fuzzyMinLines : 4,
    fuzzyMaxMismatches: typeof options.fuzzyMaxMismatches === 'number' ? options.fuzzyMaxMismatches : 3,
    fuzzyMaxMismatchRatio:
      typeof options.fuzzyMaxMismatchRatio === 'number' ? options.fuzzyMaxMismatchRatio : 0.12
  });

  if (fuzzy.success) return fuzzy;

  // Prefer a clear message: startLine error + global error, then fuzzy error.
  const errors = [exactStart?.error, exactGlobal.error, fuzzy.error].filter(Boolean) as string[];
  const error = errors.length > 0 ? errors.join(' ') : undefined;

  return {
    success: false,
    result: normalizeLineEndings(content),
    error,
    matchCount: exactGlobal.matchCount
  };
}


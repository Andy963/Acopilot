import { FileContextCollector, type FileContextCollectorOptions, type OpenFileContextInput } from './FileContextCollector';
import { debugLog } from '../../../../core/logger';

const DEFAULT_OPEN_FILE_CONTEXT_OPTIONS: Required<Pick<
  FileContextCollectorOptions,
  'maxFiles' | 'maxBytesPerFile' | 'maxLinesPerFile' | 'maxCharsPerFile' | 'maxTotalChars' | 'includeEmptyFiles'
>> = {
  maxFiles: 5,
  maxBytesPerFile: 256 * 1024,
  maxLinesPerFile: 400,
  maxCharsPerFile: 12000,
  maxTotalChars: 30000,
  includeEmptyFiles: false,
};

export async function buildOpenFileContextBlock(
  openFiles: OpenFileContextInput[] | undefined,
  overrides: (Partial<FileContextCollectorOptions> & { ignorePatterns?: string[] }) = {}
): Promise<string | undefined> {
  if (!Array.isArray(openFiles) || openFiles.length === 0) return undefined;

  const ignorePatterns = Array.isArray(overrides.ignorePatterns)
    ? overrides.ignorePatterns.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim())
    : [];

  const shouldIgnorePath = (relativePath: string): boolean => {
    if (!relativePath || ignorePatterns.length === 0) return false;
    const normalized = relativePath.replace(/\\/g, '/');

    for (const pattern of ignorePatterns) {
      const regexPattern = pattern
        .replace(/\\/g, '/')
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<GLOBSTAR>>>/g, '.*')
        .replace(/\//g, '[/\\\\]');

      const regex = new RegExp(
        `^${regexPattern}$|[/\\\\]${regexPattern}$|^${regexPattern}[/\\\\]|[/\\\\]${regexPattern}[/\\\\]`,
        'i'
      );
      if (regex.test(normalized)) {
        return true;
      }
    }
    return false;
  };

  const filtered = openFiles.filter((f) => typeof f?.path === 'string' && f.path.trim() && !shouldIgnorePath(f.path.trim()));
  if (filtered.length === 0) return undefined;

  const collector = new FileContextCollector();
  const { ignorePatterns: _ignored, ...collectorOverrides } = overrides;
  try {
    const result = await collector.collect(filtered, {
      ...DEFAULT_OPEN_FILE_CONTEXT_OPTIONS,
      ...collectorOverrides,
    });

    debugLog('[OpenFileContext] Result', {
      included: result.includedCount,
      skipped: result.skippedCount,
      totalIncludedChars: result.totalIncludedChars,
      items: result.items.map((i) => ({
        path: i.path,
        included: i.included,
        skippedReason: i.skippedReason,
        truncated: i.truncated,
        includedCharCount: i.includedCharCount,
      })),
    });

    const block = result.block.trim();
    return block ? block : undefined;
  } catch (error) {
    debugLog('[OpenFileContext] Failed to build block', error);
    return undefined;
  }
}

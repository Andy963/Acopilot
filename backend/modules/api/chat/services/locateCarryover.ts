export const LOCATE_CARRYOVER_METADATA_KEY = 'acopilotLocateCarryover';

export type LocateCarryoverOpenedFile = {
  path: string;
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
};

export type LocateCarryoverState = {
  v: 1;
  query: string;
  openedFile?: LocateCarryoverOpenedFile;
  pending: boolean;
  updatedAt: number;
};

function normalizePositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const n = Math.trunc(value);
  if (n <= 0) return undefined;
  return n;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseLocateCarryoverState(raw: unknown): LocateCarryoverState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj: any = raw;

  const query = normalizeString(obj.query);
  if (!query) return null;

  const updatedAt = typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : Date.now();
  const pending = obj.pending !== false;

  let openedFile: LocateCarryoverOpenedFile | undefined;
  if (obj.openedFile && typeof obj.openedFile === 'object' && !Array.isArray(obj.openedFile)) {
    const of: any = obj.openedFile;
    const path = normalizeString(of.path);
    if (path) {
      openedFile = {
        path,
        startLine: normalizePositiveInt(of.startLine),
        startColumn: normalizePositiveInt(of.startColumn),
        endLine: normalizePositiveInt(of.endLine),
        endColumn: normalizePositiveInt(of.endColumn),
      };
    }
  }

  return {
    v: 1,
    query,
    openedFile,
    pending,
    updatedAt,
  };
}

export function createLocateCarryoverState(query: string): LocateCarryoverState | null {
  const trimmed = normalizeString(query);
  if (!trimmed) return null;
  return {
    v: 1,
    query: trimmed.slice(0, 2000),
    pending: true,
    updatedAt: Date.now(),
  };
}

export function buildLocateCarryoverTaskContext(state: LocateCarryoverState): string {
  const opened = state.openedFile?.path
    ? `${state.openedFile.path}${state.openedFile.startLine ? `:${state.openedFile.startLine}` : ''}`
    : '';

  return [
    'PREVIOUS /locate CONTEXT (auto-carried):',
    `- query: ${state.query}`,
    opened ? `- opened: ${opened}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function withOpenedFile(
  state: LocateCarryoverState,
  openedFile: LocateCarryoverOpenedFile | undefined
): LocateCarryoverState {
  return {
    ...state,
    openedFile: openedFile?.path ? { ...openedFile, path: openedFile.path.trim() } : state.openedFile,
    pending: true,
    updatedAt: Date.now(),
  };
}


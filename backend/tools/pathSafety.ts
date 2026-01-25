import * as fs from 'fs';
import * as path from 'path';

function normalizeFsPath(fsPath: string): string {
  try {
    return fs.realpathSync.native(fsPath);
  } catch {
    return path.resolve(fsPath);
  }
}

function resolveRealpathOrParent(fsPath: string): string {
  try {
    return fs.realpathSync.native(fsPath);
  } catch {
    try {
      const parentReal = fs.realpathSync.native(path.dirname(fsPath));
      return path.join(parentReal, path.basename(fsPath));
    } catch {
      return path.resolve(fsPath);
    }
  }
}

export function isPathWithinRoot(rootFsPath: string, candidateFsPath: string): boolean {
  const base = normalizeFsPath(rootFsPath);
  const target = resolveRealpathOrParent(candidateFsPath);

  const baseForCompare = process.platform === 'win32' ? base.toLowerCase() : base;
  const targetForCompare = process.platform === 'win32' ? target.toLowerCase() : target;

  const rel = path.relative(baseForCompare, targetForCompare);
  if (rel === '') return true;
  if (rel === '..' || rel.startsWith(`..${path.sep}`)) return false;
  return !path.isAbsolute(rel);
}


import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceRootInfo {
  name: string;
  fsPath: string;
}

export type ResolveExecuteCommandWorkingDirResult =
  | { ok: true; workingDir: string; workspace: WorkspaceRootInfo }
  | { ok: false; error: string };

function isSubpath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  if (relative === '') return true;
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function trimTrailingSeparator(p: string): string {
  return p.replace(/[\\/]+$/, '');
}

function selectWorkspaceForCwd(
  workspaces: WorkspaceRootInfo[],
  cwd: string | undefined,
): { ok: true; workspace: WorkspaceRootInfo; relativePath: string } | { ok: false; error: string } {
  if (workspaces.length === 0) {
    return { ok: false, error: 'No workspace folder open' };
  }

  if (!cwd) {
    return { ok: true, workspace: workspaces[0], relativePath: '.' };
  }

  // Single workspace: treat cwd as relative to the only workspace.
  if (workspaces.length === 1) {
    return { ok: true, workspace: workspaces[0], relativePath: cwd };
  }

  // Multi-root: require explicit workspace prefix.
  // Supported formats:
  // - workspace_name/path
  // - workspace_name
  // - @workspace_name/path
  // - @workspace_name
  let input = cwd;
  if (input.startsWith('@')) {
    input = input.slice(1);
  }

  const slashIndex = input.indexOf('/');
  const workspaceName = slashIndex === -1 ? input : input.slice(0, slashIndex);
  const relativePath = slashIndex === -1 ? '.' : input.slice(slashIndex + 1);
  const workspace = workspaces.find(w => w.name.toLowerCase() === workspaceName.toLowerCase());

  if (!workspace) {
    return {
      ok: false,
      error: `Multi-root workspace requires workspace prefix. Use "workspace_name/path" format. Available workspaces: ${workspaces.map(w => w.name).join(', ')}`
    };
  }

  return { ok: true, workspace, relativePath };
}

export async function resolveExecuteCommandWorkingDir(
  workspaces: WorkspaceRootInfo[],
  cwd: string | undefined,
): Promise<ResolveExecuteCommandWorkingDirResult> {
  const selection = selectWorkspaceForCwd(workspaces, cwd);
  if (selection.ok === false) {
    return { ok: false, error: selection.error };
  }

  const workspaceRootResolved = trimTrailingSeparator(path.resolve(selection.workspace.fsPath));
  const candidateResolved = path.resolve(selection.workspace.fsPath, selection.relativePath);

  if (!isSubpath(workspaceRootResolved, candidateResolved)) {
    return {
      ok: false,
      error: `Working directory must stay within the workspace: ${selection.workspace.name}`
    };
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(candidateResolved);
  } catch {
    return {
      ok: false,
      error: `Working directory does not exist: ${candidateResolved}`
    };
  }

  if (!stat.isDirectory()) {
    return {
      ok: false,
      error: `Working directory is not a directory: ${candidateResolved}`
    };
  }

  const realWorkspaceRoot = await fs.promises.realpath(workspaceRootResolved).catch(() => workspaceRootResolved);
  const realCandidate = await fs.promises.realpath(candidateResolved).catch(() => candidateResolved);

  if (!isSubpath(realWorkspaceRoot, realCandidate)) {
    return {
      ok: false,
      error: `Working directory resolves outside the workspace via symlink: ${realCandidate}`
    };
  }

  return { ok: true, workingDir: realCandidate, workspace: selection.workspace };
}

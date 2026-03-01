import * as os from 'os';
import type { PromptContext } from './types';
import { getWorkspaceRoot } from './fileTree';

export function getPromptContext(): PromptContext {
  return {
    workspaceRoot: getWorkspaceRoot(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    os: getOsInfo()
  };
}

function getOsInfo(): string {
  const platform = os.platform();
  const release = os.release();

  switch (platform) {
    case 'win32':
      return `Windows ${release}`;
    case 'darwin':
      return `macOS ${release}`;
    case 'linux':
      return `Linux ${release}`;
    default:
      return `${platform} ${release}`;
  }
}


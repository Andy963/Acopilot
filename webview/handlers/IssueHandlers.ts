/**
 * Issue integration handlers
 */

import type { MessageHandler } from '../types';
import * as vscode from 'vscode';

type IssueProvider = 'github' | 'unknown';

function parseIssueUrl(rawUrl: string): { provider: IssueProvider; owner?: string; repo?: string; number?: number } {
  let url: URL;
  try {
    url = new URL(String(rawUrl || '').trim());
  } catch {
    return { provider: 'unknown' };
  }

  if (url.hostname !== 'github.com') return { provider: 'unknown' };

  const parts = url.pathname.split('/').filter(Boolean);
  // /{owner}/{repo}/issues/{number}
  // /{owner}/{repo}/pull/{number}
  if (parts.length >= 4 && (parts[2] === 'issues' || parts[2] === 'pull')) {
    const owner = parts[0];
    const repo = parts[1];
    const number = Number(parts[3]);
    if (!owner || !repo || !Number.isFinite(number)) return { provider: 'unknown' };
    return { provider: 'github', owner, repo, number };
  }

  return { provider: 'unknown' };
}

/**
 * Fetch issue details by URL.
 *
 * Input: { url }
 * Output: { issue: { provider, title, body, labels, repo, number, url } }
 */
export const fetchIssue: MessageHandler = async (data, requestId, ctx) => {
  const rawUrl = String(data?.url || '').trim();
  if (!rawUrl) {
    ctx.sendError(requestId, 'ISSUE_URL_REQUIRED', 'Issue URL is required');
    return;
  }

  const parsed = parseIssueUrl(rawUrl);
  if (parsed.provider !== 'github' || !parsed.owner || !parsed.repo || !parsed.number) {
    ctx.sendResponse(requestId, {
      issue: {
        provider: 'unknown',
        title: '',
        body: '',
        labels: [],
        repo: '',
        number: 0,
        url: rawUrl
      }
    });
    return;
  }

  try {
    const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/issues/${parsed.number}`;
    const res = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'limcode'
      }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub API ${res.status}: ${text || res.statusText}`);
    }

    const json: any = await res.json();
    const labels = Array.isArray(json.labels)
      ? json.labels.map((l: any) => (typeof l === 'string' ? l : l?.name)).filter(Boolean)
      : [];

    ctx.sendResponse(requestId, {
      issue: {
        provider: 'github',
        title: String(json.title || ''),
        body: String(json.body || ''),
        labels,
        repo: `${parsed.owner}/${parsed.repo}`,
        number: parsed.number,
        url: rawUrl
      }
    });
  } catch (error: any) {
    ctx.sendError(requestId, 'ISSUE_FETCH_ERROR', error?.message || 'Failed to fetch issue');
  }
};

export const openIssueUrl: MessageHandler = async (data, requestId, ctx) => {
  const rawUrl = String(data?.url || '').trim();
  if (!rawUrl) {
    ctx.sendError(requestId, 'ISSUE_URL_REQUIRED', 'Issue URL is required');
    return;
  }

  try {
    await vscode.env.openExternal(vscode.Uri.parse(rawUrl));
    ctx.sendResponse(requestId, { success: true });
  } catch (error: any) {
    ctx.sendError(requestId, 'ISSUE_OPEN_ERROR', error?.message || 'Failed to open URL');
  }
};

export function registerIssueHandlers(registry: Map<string, MessageHandler>): void {
  registry.set('issue.fetch', fetchIssue);
  registry.set('issue.open', openIssueUrl);
}

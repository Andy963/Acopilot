/**
 * Issue integration handlers
 */

import type { MessageHandler } from '../types';
import * as vscode from 'vscode';

type IssueProvider = 'github' | 'unknown';

type IssueCommentInfo = {
  id: number;
  user: string;
  createdAt: string;
  body: string;
  url?: string;
};

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

function getGitHubAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function extractImageUrls(text: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const input = String(text || '');
  if (!input) return urls;

  // Markdown: ![alt](url "title")
  const md = /!\[[^\]]*]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
  // HTML: <img src="...">
  const html = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

  const add = (raw: string) => {
    let u = String(raw || '').trim();
    if (!u) return;
    if (u.startsWith('<') && u.endsWith('>')) u = u.slice(1, -1).trim();
    if (!u) return;
    if (u.startsWith('data:')) return;
    if (!u.startsWith('http://') && !u.startsWith('https://')) return;
    if (seen.has(u)) return;
    seen.add(u);
    urls.push(u);
  };

  for (const match of input.matchAll(md)) {
    add(match[1] || '');
  }
  for (const match of input.matchAll(html)) {
    add(match[1] || '');
  }

  return urls;
}

function guessImageMimeType(bytes: Uint8Array, fallbackUrl?: string): string | null {
  if (!bytes || bytes.length < 12) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }

  // WEBP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // SVG (best-effort)
  try {
    const head = new TextDecoder().decode(bytes.slice(0, 512)).toLowerCase();
    if (head.includes('<svg')) {
      return 'image/svg+xml';
    }
  } catch {
    // ignore
  }

  if (fallbackUrl) {
    const u = String(fallbackUrl).toLowerCase();
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
    if (u.endsWith('.gif')) return 'image/gif';
    if (u.endsWith('.webp')) return 'image/webp';
    if (u.endsWith('.svg')) return 'image/svg+xml';
  }

  return null;
}

function extFromMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'img';
  }
}

/**
 * Fetch issue details by URL.
 *
 * Input: { url }
 * Output: { issue: { provider, title, body, labels, repo, number, url, commentsTotal, comments, imageUrls } }
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
        'User-Agent': 'acopilot',
        'X-GitHub-Api-Version': '2022-11-28',
        ...getGitHubAuthHeaders()
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

    const commentsTotal = typeof json.comments === 'number' ? json.comments : 0;
    const commentsUrl = typeof json.comments_url === 'string' ? json.comments_url : '';

    let comments: IssueCommentInfo[] = [];
    if (commentsUrl) {
      try {
        const commentsRes = await fetch(`${commentsUrl}?per_page=5&page=1`, {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'acopilot',
            'X-GitHub-Api-Version': '2022-11-28',
            ...getGitHubAuthHeaders()
          }
	        });
	        if (commentsRes.ok) {
	          const commentsJson = (await commentsRes.json()) as any;
	          comments = Array.isArray(commentsJson)
	            ? (commentsJson as any[]).slice(0, 5).map((c: any) => ({
	                id: Number(c?.id || 0),
	                user: String(c?.user?.login || ''),
	                createdAt: String(c?.created_at || ''),
	                body: String(c?.body || ''),
	                url: String(c?.html_url || '')
	              }))
	            : [];
	        }
	      } catch {
        // ignore comments fetch failure
      }
    }

    const imageUrls: string[] = [];
    const seenImages = new Set<string>();
    const addImages = (list: string[]) => {
      for (const u of list) {
        if (!u || seenImages.has(u)) continue;
        seenImages.add(u);
        imageUrls.push(u);
      }
    };

    addImages(extractImageUrls(String(json.body || '')));
    for (const c of comments) {
      addImages(extractImageUrls(c.body));
    }

    ctx.sendResponse(requestId, {
      issue: {
        provider: 'github',
        title: String(json.title || ''),
        body: String(json.body || ''),
        labels,
        repo: `${parsed.owner}/${parsed.repo}`,
        number: parsed.number,
        commentsTotal,
        comments,
        imageUrls,
        url: rawUrl
      }
    });
  } catch (error: any) {
    ctx.sendError(requestId, 'ISSUE_FETCH_ERROR', error?.message || 'Failed to fetch issue');
  }
};

export const fetchIssueImageAttachments: MessageHandler = async (data, requestId, ctx) => {
  const urls = Array.isArray(data?.urls)
    ? (data.urls as any[]).map(u => String(u || '').trim()).filter(Boolean)
    : [];

  const maxImagesRaw = data?.maxImages === undefined ? 5 : Number(data.maxImages);
  const maxImages = Number.isFinite(maxImagesRaw) ? Math.max(0, Math.min(10, Math.floor(maxImagesRaw))) : 5;

  const allowedHosts = new Set([
    'github.com',
    'user-images.githubusercontent.com',
    'private-user-images.githubusercontent.com'
  ]);

  const MAX_BYTES_PER_IMAGE = 5 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

  const uniqueUrls: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    uniqueUrls.push(u);
    if (uniqueUrls.length >= maxImages) break;
  }

  const attachments: Array<{ url: string; name: string; mimeType: string; size: number; data: string }> = [];
  const errors: Array<{ url: string; error: string }> = [];

  let totalBytes = 0;
  for (let i = 0; i < uniqueUrls.length; i++) {
    const raw = uniqueUrls[i];
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      errors.push({ url: raw, error: 'Invalid URL' });
      continue;
    }

    if (parsed.protocol !== 'https:') {
      errors.push({ url: raw, error: 'Only https URLs are allowed' });
      continue;
    }

    if (!allowedHosts.has(parsed.hostname)) {
      errors.push({ url: raw, error: `Host not allowed: ${parsed.hostname}` });
      continue;
    }

    try {
      const res = await fetch(parsed.toString(), {
        headers: {
          Accept: 'application/octet-stream',
          'User-Agent': 'acopilot',
          ...getGitHubAuthHeaders()
        }
      });

      if (!res.ok) {
        errors.push({ url: raw, error: `HTTP ${res.status}: ${res.statusText}` });
        continue;
      }

      const contentLength = Number(res.headers.get('content-length') || '0');
      if (Number.isFinite(contentLength) && contentLength > 0 && contentLength > MAX_BYTES_PER_IMAGE) {
        errors.push({ url: raw, error: `Image too large (${contentLength} bytes)` });
        continue;
      }

      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > MAX_BYTES_PER_IMAGE) {
        errors.push({ url: raw, error: `Image too large (${buf.length} bytes)` });
        continue;
      }

      if (totalBytes + buf.length > MAX_TOTAL_BYTES) {
        errors.push({ url: raw, error: 'Total image size limit exceeded' });
        break;
      }

      const contentType = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const mimeType = contentType.startsWith('image/')
        ? contentType
        : (guessImageMimeType(buf, raw) || '');

      if (!mimeType || !mimeType.startsWith('image/')) {
        errors.push({ url: raw, error: `Not an image (content-type: ${contentType || 'unknown'})` });
        continue;
      }

      totalBytes += buf.length;

      const base64 = Buffer.from(buf).toString('base64');
      const pathname = parsed.pathname || '';
      const last = pathname.split('/').filter(Boolean).pop() || '';
      const safeBase = last.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
      const ext = extFromMime(mimeType);
      const name = safeBase && safeBase.includes('.') ? safeBase : `issue-image-${i + 1}.${ext}`;

      attachments.push({
        url: raw,
        name,
        mimeType,
        size: buf.length,
        data: base64
      });
    } catch (e: any) {
      errors.push({ url: raw, error: e?.message || String(e) });
    }
  }

  ctx.sendResponse(requestId, { success: true, attachments, errors });
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
  registry.set('issue.fetchImageAttachments', fetchIssueImageAttachments);
  registry.set('issue.open', openIssueUrl);
}

import * as fs from 'fs';
import * as path from 'path';

export interface FrontendBuildAssets {
  scriptPaths: string[];
  stylePaths: string[];
}

const LINK_TAG_RE = /<link\b[^>]*>/gi;
const SCRIPT_TAG_RE = /<script\b[^>]*><\/script>/gi;

function getAttribute(tag: string, attribute: string): string | null {
  const match = new RegExp(`\\b${attribute}\\s*=\\s*(['"])(.*?)\\1`, 'i').exec(tag);
  return match?.[2] ?? null;
}

function normalizeAssetPath(rawPath: string | null): string | null {
  if (!rawPath) return null;

  const withoutQuery = rawPath.split(/[?#]/, 1)[0]?.trim();
  if (!withoutQuery) return null;
  if (/^[a-z]+:/i.test(withoutQuery) || withoutQuery.startsWith('//')) return null;

  const normalized = withoutQuery.replace(/^\/+/, '');
  if (!normalized) return null;
  if (normalized.startsWith('../') || normalized.includes('/../')) return null;

  return normalized;
}

export function parseFrontendBuildAssets(indexHtml: string): FrontendBuildAssets {
  const scriptPaths: string[] = [];
  const stylePaths: string[] = [];

  for (const tag of indexHtml.match(LINK_TAG_RE) ?? []) {
    const rel = getAttribute(tag, 'rel');
    if (rel?.toLowerCase() !== 'stylesheet') continue;

    const normalized = normalizeAssetPath(getAttribute(tag, 'href'));
    if (normalized) stylePaths.push(normalized);
  }

  for (const tag of indexHtml.match(SCRIPT_TAG_RE) ?? []) {
    const normalized = normalizeAssetPath(getAttribute(tag, 'src'));
    if (normalized) scriptPaths.push(normalized);
  }

  return {
    scriptPaths: [...new Set(scriptPaths)],
    stylePaths: [...new Set(stylePaths)],
  };
}

export function readFrontendBuildAssets(indexHtmlPath: string): FrontendBuildAssets {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
  return parseFrontendBuildAssets(indexHtml);
}

export function resolveFrontendAssetFsPath(distDir: string, assetPath: string): string {
  return path.join(distDir, assetPath);
}

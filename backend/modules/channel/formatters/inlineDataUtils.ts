/**
 * Utilities for handling inlineData attachments across providers.
 *
 * Problem:
 * - LimCode stores user attachments as Gemini-style `inlineData` (base64 + mimeType).
 * - Some providers (OpenAI/Anthropic) only support images in their multimodal blocks.
 * - Text files like `text/markdown` must be decoded and sent as text instead.
 */

export const DEFAULT_MAX_TEXT_ATTACHMENT_CHARS = 200_000;

export function isImageMimeType(mimeType: string | undefined): boolean {
  return !!mimeType && mimeType.startsWith('image/');
}

const EXTRA_TEXT_MIME_TYPES = new Set<string>([
  'application/json',
  'application/xml',
  'application/xhtml+xml',
  'application/javascript',
  'application/x-javascript',
  'application/x-www-form-urlencoded',
  'application/sql'
]);

export function isTextMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  if (mimeType.startsWith('text/')) return true;
  if (mimeType.endsWith('+json') || mimeType.endsWith('+xml')) return true;
  return EXTRA_TEXT_MIME_TYPES.has(mimeType);
}

export function decodeBase64ToUtf8(base64: string): string | null {
  try {
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

export function formatTextAttachment(params: {
  mimeType: string;
  text: string;
  displayName?: string;
  maxChars?: number;
}): string {
  const maxChars = params.maxChars ?? DEFAULT_MAX_TEXT_ATTACHMENT_CHARS;
  const label = params.displayName?.trim()
    ? `Attachment (${params.mimeType}) ${params.displayName}`
    : `Attachment (${params.mimeType})`;

  let body = params.text;
  let truncated = false;
  if (body.length > maxChars) {
    body = body.slice(0, maxChars);
    truncated = true;
  }

  const truncationNote = truncated
    ? `\n\n[Truncated: showing first ${maxChars} chars of ${params.text.length}]`
    : '';

  return `${label}:\n\n${body}${truncationNote}`;
}

export function formatUnsupportedAttachment(params: {
  mimeType: string;
  displayName?: string;
}): string {
  const label = params.displayName?.trim()
    ? `Attachment (${params.mimeType}) ${params.displayName}`
    : `Attachment (${params.mimeType})`;
  return `${label}: [unsupported attachment type, not sent]`;
}


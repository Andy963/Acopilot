import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf8');
}

describe('attachment context enhancements', () => {
  it('shows model support and token cost on attachment chips without the composer context guide', () => {
    const topBar = readProjectFile('frontend/src/components/input/ComposerTopBar.vue');
    const inputI18n = readProjectFile('frontend/src/i18n/langs/en/components/input.ts');

    expect(topBar).not.toContain('contextLifecycleTooltip');
    expect(topBar).not.toContain('context-lifecycle-chip');
    expect(topBar).toContain('getAttachmentSupport');
    expect(topBar).toContain('getTextAttachmentCharCount');
    expect(topBar).toContain('isGeminiInlineSupportedMime');
    expect(topBar).toContain('estimateAttachmentTokens');
    expect(topBar).toContain('isAttachmentTruncated');
    expect(topBar).toContain('attachment-token-cost');
    expect(topBar).toContain('attachment-support');
    expect(inputI18n).not.toContain('contextLifecycle');
    expect(inputI18n).toContain('attachmentSupport');
  });

  it('adds attachment token and truncation metadata to Context Inspector data', () => {
    const contextInfo = readProjectFile('backend/modules/api/chat/services/contextInjectionInfo.ts');
    const backendTypes = readProjectFile('backend/modules/conversation/types/context.ts');
    const frontendTypes = readProjectFile('frontend/src/types/ui.ts');
    const inspector = readProjectFile('frontend/src/components/common/ContextInspectorModal.vue');

    expect(contextInfo).toContain('estimateAttachmentTokens');
    expect(contextInfo).toContain('MAX_TEXT_ATTACHMENT_CHARS');
    expect(contextInfo).toContain('getTextCharCount');
    expect(contextInfo).toContain('inclusionMode');
    expect(backendTypes).toContain('estimatedTokens?: number');
    expect(frontendTypes).toContain('estimatedTokens?: number');
    expect(inspector).toContain('item.estimatedTokens');
    expect(inspector).toContain('item.inclusionMode');
  });
});

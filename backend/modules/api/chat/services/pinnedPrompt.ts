import type { ConversationManager } from '../../../conversation/ConversationManager';
import { getGlobalSettingsManager } from '../../../../core/settingsContext';
import type { SkillDefinition } from '../../../settings/types';

export type ConversationPinnedPromptMode = 'none' | 'skill' | 'custom';

export interface ConversationPinnedPrompt {
    mode: ConversationPinnedPromptMode;
    skillId?: string;
    customPrompt?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSkills(raw: unknown): SkillDefinition[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .filter((s): s is SkillDefinition => isRecord(s))
        .map((s) => ({
            id: String(s.id || '').trim(),
            name: String(s.name || '').trim(),
            description: typeof s.description === 'string' ? s.description : undefined,
            prompt: String((s as any).prompt || '')
        }))
        .filter((s) => s.id && s.prompt.trim());
}

export async function getPinnedPromptBlock(
    conversationManager: ConversationManager,
    conversationId: string
): Promise<string> {
    const rawPinnedPrompt = await conversationManager.getCustomMetadata(conversationId, 'pinnedPrompt');

    if (!isRecord(rawPinnedPrompt)) {
        return '';
    }

    const mode = typeof rawPinnedPrompt.mode === 'string'
        ? (rawPinnedPrompt.mode as ConversationPinnedPromptMode)
        : 'none';

    if (mode === 'skill') {
        const skillId = typeof rawPinnedPrompt.skillId === 'string'
            ? rawPinnedPrompt.skillId.trim()
            : '';
        if (!skillId) return '';

        const settingsManager = getGlobalSettingsManager();
        const skills = normalizeSkills(settingsManager?.getSystemPromptConfig()?.skills);
        const skill = skills.find((s) => s.id === skillId);
        if (!skill) return '';

        const title = skill.name ? `SKILL: ${skill.name}` : 'SKILL';
        const prompt = skill.prompt.trim();
        if (!prompt) return '';

        return `====\n\n${title}\n\n${prompt}`;
    }

    if (mode === 'custom') {
        const prompt = typeof rawPinnedPrompt.customPrompt === 'string'
            ? rawPinnedPrompt.customPrompt.trim()
            : '';
        if (!prompt) return '';

        return `====\n\nPINNED PROMPT\n\n${prompt}`;
    }

    return '';
}


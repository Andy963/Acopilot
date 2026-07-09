import type { ConversationManager } from '../../../conversation/ConversationManager';
import { getGlobalSettingsManager } from '../../../../core/settingsContext';
import type { PinnedPromptPreset, SkillDefinition } from '../../../settings/types';

export type ConversationPinnedPromptMode = 'none' | 'skill' | 'custom' | 'preset';
export type ActivePinnedPromptMode = Exclude<ConversationPinnedPromptMode, 'none'>;

export interface ConversationPinnedPrompt {
    mode: ConversationPinnedPromptMode;
    skillId?: string;
    presetId?: string;
    customPrompt?: string;
}

export interface ConversationPinnedPromptItem {
    id?: string;
    mode: ActivePinnedPromptMode;
    skillId?: string;
    presetId?: string;
    customPrompt?: string;
    name?: string;
    enabled?: boolean;
    order?: number;
}

export interface ResolvedPinnedPromptBlock {
    id: string;
    mode: ActivePinnedPromptMode;
    title: string;
    prompt: string;
    skillId?: string;
    skillName?: string;
    presetId?: string;
    presetName?: string;
    customPromptCharCount?: number;
}

export interface PinnedPromptInjectedItem {
    id: string;
    mode: ActivePinnedPromptMode;
    skillId?: string;
    skillName?: string;
    presetId?: string;
    presetName?: string;
    name?: string;
    customPromptCharCount?: number;
}

export interface PinnedPromptInjectedInfo {
    mode: ConversationPinnedPromptMode | 'multiple';
    skillId?: string;
    skillName?: string;
    presetId?: string;
    presetName?: string;
    customPromptCharCount?: number;
    count?: number;
    prompts?: PinnedPromptInjectedItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeSkills(raw: unknown): SkillDefinition[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .filter((s): s is SkillDefinition => isRecord(s))
        .map((s) => ({
            id: String(s.id || '').trim(),
            name: typeof s.name === 'string' ? s.name.trim() : '',
            description: typeof s.description === 'string' ? s.description : undefined,
            prompt: String((s as any).prompt || '')
        }))
        .filter((s) => s.id && s.prompt.trim());
}

function normalizePinnedPromptPresets(raw: unknown): PinnedPromptPreset[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .filter((preset): preset is PinnedPromptPreset => isRecord(preset))
        .map((preset) => ({
            id: String(preset.id || '').trim(),
            name: typeof preset.name === 'string' ? preset.name.trim() : '',
            prompt: String((preset as any).prompt || '')
        }))
        .filter((preset) => preset.id && preset.prompt.trim());
}

function normalizeMode(value: unknown): ActivePinnedPromptMode | null {
    if (value === 'skill' || value === 'preset' || value === 'custom') return value;
    return null;
}

function fallbackPromptId(item: ConversationPinnedPromptItem, index: number): string {
    if (item.mode === 'skill' && item.skillId) return `skill:${item.skillId}`;
    if (item.mode === 'preset' && item.presetId) return `preset:${item.presetId}`;
    return `custom:${index + 1}`;
}

function normalizePromptItem(raw: unknown, index: number): ConversationPinnedPromptItem | null {
    if (!isRecord(raw)) return null;
    const mode = normalizeMode(raw.mode);
    if (!mode) return null;

    const item: ConversationPinnedPromptItem = {
        id: cleanString(raw.id),
        mode,
        skillId: cleanString(raw.skillId),
        presetId: cleanString(raw.presetId),
        customPrompt: typeof raw.customPrompt === 'string' ? raw.customPrompt : '',
        name: cleanString(raw.name),
        enabled: raw.enabled !== false,
        order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : index,
    };

    if (!item.id) {
        item.id = fallbackPromptId(item, index);
    }

    return item;
}

function legacyPromptToItem(raw: unknown): ConversationPinnedPromptItem | null {
    if (!isRecord(raw)) return null;
    const mode = normalizeMode(raw.mode);
    if (!mode) return null;

    return normalizePromptItem({
        ...raw,
        id:
            mode === 'skill'
                ? `skill:${cleanString(raw.skillId)}`
                : mode === 'preset'
                    ? `preset:${cleanString(raw.presetId)}`
                    : 'custom:legacy',
        enabled: true,
        order: 0,
    }, 0);
}

async function getConversationPinnedPromptItems(
    conversationManager: ConversationManager,
    conversationId: string
): Promise<ConversationPinnedPromptItem[]> {
    const rawPinnedPrompts = await conversationManager.getCustomMetadata(conversationId, 'pinnedPrompts');

    if (Array.isArray(rawPinnedPrompts)) {
        return rawPinnedPrompts
            .map(normalizePromptItem)
            .filter((item): item is ConversationPinnedPromptItem => !!item && item.enabled !== false)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    const rawPinnedPrompt = await conversationManager.getCustomMetadata(conversationId, 'pinnedPrompt');
    const legacy = legacyPromptToItem(rawPinnedPrompt);
    return legacy && legacy.enabled !== false ? [legacy] : [];
}

export async function getPinnedPromptBlocks(
    conversationManager: ConversationManager,
    conversationId: string
): Promise<ResolvedPinnedPromptBlock[]> {
    const settingsManager = getGlobalSettingsManager();
    const skills = normalizeSkills(settingsManager?.getSystemPromptConfig()?.skills);
    const presets = normalizePinnedPromptPresets(settingsManager?.getSystemPromptConfig()?.pinnedPromptPresets);
    const items = await getConversationPinnedPromptItems(conversationManager, conversationId);

    const blocks: ResolvedPinnedPromptBlock[] = [];

    for (const item of items) {
        if (item.mode === 'skill') {
            const skillId = cleanString(item.skillId);
            if (!skillId) continue;

            const skill = skills.find((s) => s.id === skillId);
            if (!skill) continue;

            const prompt = skill.prompt.trim();
            if (!prompt) continue;

            const skillName = skill.name || skill.id;
            blocks.push({
                id: item.id || `skill:${skillId}`,
                mode: 'skill',
                title: `SKILL: ${skillName}`,
                prompt,
                skillId,
                skillName,
            });
            continue;
        }

        if (item.mode === 'preset') {
            const presetId = cleanString(item.presetId);
            if (!presetId) continue;

            const preset = presets.find((p) => p.id === presetId);
            if (!preset) continue;

            const prompt = preset.prompt.trim();
            if (!prompt) continue;

            const presetName = preset.name || preset.id;
            blocks.push({
                id: item.id || `preset:${presetId}`,
                mode: 'preset',
                title: `PINNED PROMPT: ${presetName}`,
                prompt,
                presetId,
                presetName,
            });
            continue;
        }

        const prompt = cleanString(item.customPrompt);
        if (!prompt) continue;

        const name = item.name || 'Custom';
        blocks.push({
            id: item.id || 'custom:legacy',
            mode: 'custom',
            title: name ? `PINNED PROMPT: ${name}` : 'PINNED PROMPT',
            prompt,
            customPromptCharCount: prompt.length,
        });
    }

    return blocks;
}

export function renderPinnedPromptBlocks(blocks: ResolvedPinnedPromptBlock[]): string {
    return blocks
        .map((block) => `====\n\n${block.title}\n\n${block.prompt}`)
        .filter(Boolean)
        .join('\n\n');
}

export function applyPinnedPromptPlaceholders(
    baseSystemPrompt: string,
    blocks: ResolvedPinnedPromptBlock[]
): string {
    if (blocks.length === 0) return baseSystemPrompt;

    const consumed = new Set<string>();
    let usedPlaceholder = false;
    let result = baseSystemPrompt;

    result = result.replace(/\{\{\$PINNED_PROMPT:([^}]+)\}\}/g, (_match, rawId: string) => {
        usedPlaceholder = true;
        const id = String(rawId || '').trim();
        if (!id || consumed.has(id)) return '';

        const block = blocks.find((candidate) => candidate.id === id);
        if (!block) return '';

        consumed.add(id);
        return renderPinnedPromptBlocks([block]);
    });

    if (result.includes('{{$PINNED_PROMPTS}}')) {
        usedPlaceholder = true;
        const remaining = blocks.filter((block) => !consumed.has(block.id));
        const rendered = renderPinnedPromptBlocks(remaining);
        result = result.replace(/\{\{\$PINNED_PROMPTS\}\}/g, rendered);
    }

    if (!usedPlaceholder) {
        return [renderPinnedPromptBlocks(blocks), baseSystemPrompt]
            .filter(Boolean)
            .join('\n\n');
    }

    return result;
}

export async function getPinnedPromptInjectedInfo(
    conversationManager: ConversationManager,
    conversationId: string
): Promise<PinnedPromptInjectedInfo> {
    const blocks = await getPinnedPromptBlocks(conversationManager, conversationId);

    if (blocks.length === 0) {
        return { mode: 'none' };
    }

    const prompts: PinnedPromptInjectedItem[] = blocks.map((block) => ({
        id: block.id,
        mode: block.mode,
        skillId: block.skillId,
        skillName: block.skillName,
        presetId: block.presetId,
        presetName: block.presetName,
        name: block.title,
        customPromptCharCount: block.customPromptCharCount,
    }));

    if (blocks.length === 1) {
        const only = blocks[0];
        return {
            mode: only.mode,
            skillId: only.skillId,
            skillName: only.skillName,
            presetId: only.presetId,
            presetName: only.presetName,
            customPromptCharCount: only.customPromptCharCount,
            count: 1,
            prompts,
        };
    }

    return {
        mode: 'multiple',
        count: blocks.length,
        prompts,
    };
}

export async function getPinnedPromptBlock(
    conversationManager: ConversationManager,
    conversationId: string
): Promise<string> {
    const blocks = await getPinnedPromptBlocks(conversationManager, conversationId);
    return renderPinnedPromptBlocks(blocks);
}

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { SettingsStorage } from './SettingsManager';
import type { GlobalSettings } from './types';

type PlainObject = Record<string, unknown>;

const SECTION = 'acopilot';
const SETTINGS_KEY = 'settings';
const MACHINE_KEYS = ['proxy', 'storagePath'] as const;

function isPlainObject(value: unknown): value is PlainObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepCloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function stripKeys<T extends PlainObject>(value: T, keys: readonly string[]): T {
    const out = { ...value };
    for (const key of keys) {
        delete (out as PlainObject)[key];
    }
    return out;
}

export class VSCodeSettingsStorage implements SettingsStorage {
    private readonly legacySettingsFilePath: string;

    constructor(options: { legacySettingsFilePath: string }) {
        this.legacySettingsFilePath = options.legacySettingsFilePath;
    }

    private getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(SECTION);
    }

    private getGlobalValue<T>(config: vscode.WorkspaceConfiguration, key: string): T | undefined {
        const inspected = config.inspect<T>(key);
        if (!inspected) return undefined;
        return inspected.globalValue;
    }

    private hasAnyUserValue(config: vscode.WorkspaceConfiguration): boolean {
        if (this.getGlobalValue<unknown>(config, SETTINGS_KEY) !== undefined) return true;
        for (const key of MACHINE_KEYS) {
            if (this.getGlobalValue<unknown>(config, key) !== undefined) return true;
        }
        return false;
    }

    async load(): Promise<GlobalSettings | null> {
        const config = this.getConfiguration();

        if (!this.hasAnyUserValue(config)) {
            const migrated = await this.tryMigrateLegacySettings();
            if (migrated) return migrated;
            return null;
        }

        const baseRaw = this.getGlobalValue<unknown>(config, SETTINGS_KEY);
        const base = isPlainObject(baseRaw) ? deepCloneJson(baseRaw) : {};

        for (const key of MACHINE_KEYS) {
            const value = this.getGlobalValue<unknown>(config, key);
            if (value !== undefined) {
                base[key] = deepCloneJson(value);
            }
        }

        return base as unknown as GlobalSettings;
    }

    async save(settings: GlobalSettings): Promise<void> {
        const config = this.getConfiguration();

        const plain = isPlainObject(settings) ? (settings as PlainObject) : {};
        const base = stripKeys(deepCloneJson(plain), MACHINE_KEYS);

        const tasks: Array<Thenable<void>> = [
            config.update(SETTINGS_KEY, base, vscode.ConfigurationTarget.Global),
        ];

        for (const key of MACHINE_KEYS) {
            const value = (plain as PlainObject)[key];
            tasks.push(
                config.update(key, value === undefined ? undefined : deepCloneJson(value), vscode.ConfigurationTarget.Global),
            );
        }

        await Promise.all(tasks);
    }

    private async tryMigrateLegacySettings(): Promise<GlobalSettings | null> {
        const legacy = await this.loadLegacySettingsFile();
        if (!legacy) return null;

        await this.save(legacy);
        await this.backupLegacySettingsFile();
        return legacy;
    }

    private async loadLegacySettingsFile(): Promise<GlobalSettings | null> {
        try {
            const content = await fs.readFile(this.legacySettingsFilePath, 'utf-8');
            const parsed = JSON.parse(content) as unknown;
            if (!isPlainObject(parsed)) return null;
            return parsed as unknown as GlobalSettings;
        } catch (error: any) {
            if (error?.code === 'ENOENT') return null;
            console.error('Failed to load legacy settings file:', error);
            return null;
        }
    }

    private async backupLegacySettingsFile(): Promise<void> {
        try {
            const dir = path.dirname(this.legacySettingsFilePath);
            const base = path.basename(this.legacySettingsFilePath);
            const bakPath = path.join(dir, `${base}.bak`);

            try {
                await fs.stat(bakPath);
                const datedBakPath = path.join(dir, `${base}.bak.${Date.now()}`);
                await fs.rename(this.legacySettingsFilePath, datedBakPath);
                return;
            } catch {
                // ignore
            }

            await fs.rename(this.legacySettingsFilePath, bakPath);
        } catch (error: any) {
            if (error?.code === 'ENOENT') return;
            console.error('Failed to backup legacy settings file:', error);
        }
    }
}

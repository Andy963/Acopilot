import * as path from 'path';
import * as fs from 'fs/promises';

const PATTERN_REGEX_CACHE = new Map<string, RegExp>();
const PATTERN_REGEX_CACHE_MAX_SIZE = 2048;

function parseGitignore(content: string): string[] {
    return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}

function matchPattern(str: string, pattern: string): boolean {
    const cached = PATTERN_REGEX_CACHE.get(pattern);
    if (cached) {
        return cached.test(str);
    }

    let regexStr = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<GLOBSTAR>>>/g, '.*')
        .replace(/\?/g, '[^/]');

    if (!pattern.startsWith('/')) {
        regexStr = '(^|/)' + regexStr;
    } else {
        regexStr = '^' + regexStr.slice(1);
    }

    if (!pattern.endsWith('**')) {
        regexStr += '(/.*)?$';
    }

    try {
        const regex = new RegExp(regexStr);
        if (PATTERN_REGEX_CACHE.size >= PATTERN_REGEX_CACHE_MAX_SIZE) {
            PATTERN_REGEX_CACHE.clear();
        }
        PATTERN_REGEX_CACHE.set(pattern, regex);
        return regex.test(str);
    } catch {
        return str === pattern || str.endsWith('/' + pattern);
    }
}

function matchesGitignore(relativePath: string, patterns: string[]): boolean {
    const pathParts = relativePath.split(path.sep);

    for (const pattern of patterns) {
        if (pattern.startsWith('!')) {
            continue;
        }

        const cleanPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;

        if (cleanPattern.includes('/')) {
            if (matchPattern(relativePath, cleanPattern)) {
                return true;
            }
        } else {
            for (const part of pathParts) {
                if (matchPattern(part, cleanPattern)) {
                    return true;
                }
            }
        }
    }

    return false;
}

async function collectGitignoreFiles(
    rootDir: string,
    currentDir: string,
    patterns: string[]
): Promise<void> {
    const gitignorePath = path.join(currentDir, '.gitignore');
    const relativeDirPath = path.relative(rootDir, currentDir);

    try {
        const content = await fs.readFile(gitignorePath, 'utf-8');
        const parsed = parseGitignore(content);

        for (const pattern of parsed) {
            if (relativeDirPath) {
                if (pattern.startsWith('/')) {
                    patterns.push(relativeDirPath + pattern);
                } else {
                    patterns.push(pattern);
                }
            } else {
                patterns.push(pattern);
            }
        }
    } catch {
        // ignore
    }

    try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(rootDir, fullPath);

            if (matchesGitignore(relativePath, patterns)) {
                continue;
            }

            await collectGitignoreFiles(rootDir, fullPath, patterns);
        }
    } catch {
        // ignore
    }
}

export async function loadAllGitignorePatterns(rootDir: string, customIgnorePatterns?: string[]): Promise<string[]> {
    const patterns: string[] = [];

    patterns.push('.git');
    patterns.push('node_modules');

    await collectGitignoreFiles(rootDir, rootDir, patterns);

    if (customIgnorePatterns) {
        patterns.push(...customIgnorePatterns);
    }

    return patterns;
}

export async function collectFilesAndDirsWithPatterns(
    rootDir: string,
    patterns: string[],
    currentDir?: string,
    result?: { files: string[]; dirs: string[] }
): Promise<{ files: string[]; dirs: string[] }> {
    if (!result) {
        result = { files: [], dirs: [] };
    }

    const dir = currentDir || rootDir;

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        let hasChildren = false;

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(rootDir, fullPath);

            if (matchesGitignore(relativePath, patterns)) {
                continue;
            }

            hasChildren = true;

            if (entry.isDirectory()) {
                await collectFilesAndDirsWithPatterns(rootDir, patterns, fullPath, result);
            } else if (entry.isFile()) {
                result.files.push(fullPath);
            }
        }

        if (!hasChildren && dir !== rootDir) {
            result.dirs.push(dir);
        }
    } catch {
        // ignore
    }

    return result;
}

export async function collectFilesWithPatterns(
    rootDir: string,
    patterns: string[],
    currentDir?: string,
    files: string[] = []
): Promise<string[]> {
    const result = await collectFilesAndDirsWithPatterns(rootDir, patterns, currentDir, { files, dirs: [] });
    return result.files;
}

export async function collectFilesAndDirs(
    rootDir: string,
    customIgnorePatterns?: string[],
    currentDir?: string,
    result?: { files: string[]; dirs: string[] },
    patterns?: string[]
): Promise<{ files: string[]; dirs: string[] }> {
    const effectivePatterns = patterns ?? await loadAllGitignorePatterns(rootDir, customIgnorePatterns);
    return collectFilesAndDirsWithPatterns(rootDir, effectivePatterns, currentDir, result);
}

export async function cleanupEmptyDirsRecursive(dir: string, ignorePatterns: string[], rootDir?: string): Promise<void> {
    const root = rootDir || dir;

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(root, fullPath);

            if (matchesGitignore(relativePath, ignorePatterns)) {
                continue;
            }

            await cleanupEmptyDirsRecursive(fullPath, ignorePatterns, root);

            try {
                const subEntries = await fs.readdir(fullPath);
                if (subEntries.length === 0) {
                    await fs.rmdir(fullPath);
                }
            } catch {
                // ignore
            }
        }
    } catch {
        // ignore
    }
}
